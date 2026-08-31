import { VIDEO_WORKSPACE_SCHEMA_VERSION, type RenderDispatchMessage } from "../lib/video-workspace/contracts";
import { createScopedJobToken } from "../lib/video-workspace/job-auth";
import { AwsBatchRenderProvider, type VideoRenderProvider } from "./video-render-provider";

interface Env {
  DB: D1Database;
  VIDEO_RENDER_QUEUE: Queue<RenderDispatchMessage>;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_SESSION_TOKEN?: string;
  AWS_REGION: string;
  AWS_BATCH_JOB_QUEUE: string;
  AWS_BATCH_JOB_DEFINITION: string;
  SCRIBIX_INTERNAL_URL: string;
  VIDEO_WORKER_SIGNING_SECRET: string;
}

type DispatchJobRow = {
  id: string;
  status: string;
  provider_job_id: string | null;
};

type ReconcileJobRow = DispatchJobRow & {
  output_asset_id: string;
};

const MAX_DISPATCH_ATTEMPTS = 5;

export default {
  async queue(
    batch: MessageBatch<RenderDispatchMessage>,
    env: Env
  ): Promise<void> {
    const provider = providerFor(env);
    for (const message of batch.messages) {
      if (!validMessage(message.body)) {
        console.error(JSON.stringify({ event: "video_dispatch_invalid_message", messageId: message.id }));
        message.ack();
        continue;
      }
      try {
        const dispatched = await dispatchJob(env, provider, message.body.jobId);
        if (dispatched !== "retry") {
          message.ack();
          continue;
        }
        message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
      } catch (error) {
        const permanent = message.attempts >= MAX_DISPATCH_ATTEMPTS;
        await markDispatchError(env.DB, message.body.jobId, permanent);
        console.error(JSON.stringify({
          event: "video_dispatch_failed",
          jobId: message.body.jobId,
          attempt: message.attempts,
          permanent,
          error: error instanceof Error ? error.message.slice(0, 160) : "unknown",
        }));
        if (permanent) message.ack();
        else message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
      }
    }
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(reconcileJobs(env));
  },
};

async function dispatchJob(
  env: Env,
  provider: VideoRenderProvider,
  jobId: string
): Promise<"submitted" | "ignored" | "retry"> {
  const claimed = await env.DB.prepare(
    `UPDATE render_jobs
        SET status = 'preparing', provider = 'aws-batch', attempt = attempt + 1,
            error_code = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1
        AND kind = 'preview'
        AND status = 'queued'
        AND provider_job_id IS NULL`
  )
    .bind(jobId)
    .run();
  if (!claimed.meta?.changes) {
    const current = await env.DB.prepare(
      `SELECT id, status, provider_job_id FROM render_jobs WHERE id = ?1 AND kind = 'preview'`
    )
      .bind(jobId)
      .first<DispatchJobRow>();
    if (!current) return "ignored";
    return current.status === "queued" ? "retry" : "ignored";
  }

  const jobToken = await createScopedJobToken(env.VIDEO_WORKER_SIGNING_SECRET, jobId);
  const providerJobId = await provider.submitPreview({
    jobId,
    jobToken,
    internalBaseUrl: env.SCRIBIX_INTERNAL_URL.replace(/\/$/, ""),
  });
  const updated = await env.DB.prepare(
    `UPDATE render_jobs
        SET provider_job_id = ?1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?2
        AND kind = 'preview'
        AND status = 'preparing'
        AND provider_job_id IS NULL`
  )
    .bind(providerJobId, jobId)
    .run();
  if (!updated.meta?.changes) {
    console.error(JSON.stringify({
      event: "video_dispatch_provider_job_unattached",
      jobId,
      providerJobId,
    }));
  }
  return "submitted";
}

async function reconcileJobs(env: Env): Promise<void> {
  const staleUndispatched = await env.DB.prepare(
    `SELECT id
       FROM render_jobs
      WHERE kind = 'preview'
        AND provider_job_id IS NULL
        AND (
          (status = 'queued' AND queued_at < datetime('now', '-2 minutes'))
          OR (status = 'preparing' AND updated_at < datetime('now', '-5 minutes'))
        )
      ORDER BY created_at ASC
      LIMIT 100`
  ).all<{ id: string }>();
  for (const job of staleUndispatched.results) {
    await env.DB.prepare(
      `UPDATE render_jobs
          SET status = 'queued', provider = NULL, queued_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND provider_job_id IS NULL AND status IN ('queued', 'preparing')`
    )
      .bind(job.id)
      .run();
    await env.VIDEO_RENDER_QUEUE.send({
      schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION,
      jobId: job.id,
    });
  }

  const active = await env.DB.prepare(
    `SELECT id, status, provider_job_id, output_asset_id
       FROM render_jobs
      WHERE kind = 'preview'
        AND provider = 'aws-batch'
        AND provider_job_id IS NOT NULL
        AND status IN ('preparing', 'running', 'uploading')
      ORDER BY updated_at ASC
      LIMIT 100`
  ).all<ReconcileJobRow>();
  if (active.results.length === 0) return;
  const states = await providerFor(env).describe(
    active.results.flatMap((job) => job.provider_job_id ? [job.provider_job_id] : [])
  );
  for (const job of active.results) {
    const state = job.provider_job_id ? states.get(job.provider_job_id) : undefined;
    if (!state) continue;
    if (state === "failed" || state === "succeeded") {
      await failReconciledJob(
        env.DB,
        job,
        state === "failed" ? "render_failed" : "upload_failed"
      );
      continue;
    }
    const status = state === "running" ? "running" : "preparing";
    await env.DB.prepare(
      `UPDATE render_jobs
          SET status = CASE WHEN status = 'uploading' THEN status ELSE ?1 END,
              started_at = CASE WHEN ?1 = 'running' THEN COALESCE(started_at, CURRENT_TIMESTAMP) ELSE started_at END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?2 AND status IN ('preparing', 'running', 'uploading')`
    )
      .bind(status, job.id)
      .run();
  }
}

async function markDispatchError(
  db: D1Database,
  jobId: string,
  permanent: boolean
): Promise<void> {
  if (!permanent) {
    await db.prepare(
      `UPDATE render_jobs
          SET status = 'queued', provider = NULL, provider_job_id = NULL,
              error_code = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND kind = 'preview' AND status = 'preparing'`
    )
      .bind(jobId)
      .run();
    return;
  }
  const job = await db.prepare(
    `SELECT id, status, provider_job_id, output_asset_id
       FROM render_jobs WHERE id = ?1 AND kind = 'preview'`
  )
    .bind(jobId)
    .first<ReconcileJobRow>();
  if (job) await failReconciledJob(db, job, "provider_unavailable");
}

async function failReconciledJob(
  db: D1Database,
  job: ReconcileJobRow,
  errorCode: "render_failed" | "upload_failed" | "provider_unavailable"
): Promise<void> {
  await db.batch([
    db.prepare(
      `UPDATE media_assets SET status = 'failed'
        WHERE id = ?1 AND status <> 'ready'`
    ).bind(job.output_asset_id),
    db.prepare(
      `UPDATE render_jobs
          SET status = 'failed', error_code = ?1,
              completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?2 AND status <> 'completed'`
    ).bind(errorCode, job.id),
  ]);
}

function providerFor(env: Env): VideoRenderProvider {
  return new AwsBatchRenderProvider({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
    region: env.AWS_REGION,
    jobQueue: env.AWS_BATCH_JOB_QUEUE,
    jobDefinition: env.AWS_BATCH_JOB_DEFINITION,
  });
}

function validMessage(value: unknown): value is RenderDispatchMessage {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as { schemaVersion?: unknown }).schemaVersion === VIDEO_WORKSPACE_SCHEMA_VERSION &&
    typeof (value as { jobId?: unknown }).jobId === "string" &&
    (value as { jobId: string }).jobId.length > 0
  );
}

function retryDelaySeconds(attempt: number): number {
  return Math.min(300, 15 * 2 ** Math.max(0, attempt - 1));
}
