import { Container } from "@cloudflare/containers";
import { VIDEO_WORKSPACE_SCHEMA_VERSION, type RenderDispatchMessage } from "../lib/video-workspace/contracts";
import { createScopedJobToken } from "../lib/video-workspace/job-auth";
import { recordServerRenderEvent } from "../lib/video-workspace/events";
import {
  estimateRenderCost,
  parseRenderCostRates,
  percentile,
  renderErrorCategory,
} from "../lib/video-workspace/operations";
import { CloudflareContainerRenderProvider, type VideoRenderProvider } from "./video-render-provider";

interface Env {
  DB: D1Database;
  VIDEO_RENDER_QUEUE: Queue<RenderDispatchMessage>;
  VIDEO_RENDER_CONTAINERS: DurableObjectNamespace<VideoRenderContainer>;
  SCRIBIX_INTERNAL_URL: string;
  VIDEO_WORKER_SIGNING_SECRET: string;
  VIDEO_RENDER_MAX_CONTAINERS?: string;
  VIDEO_RENDER_VCPU_MICROUSD_PER_HOUR?: string;
  VIDEO_RENDER_MEMORY_GB_MICROUSD_PER_HOUR?: string;
  VIDEO_RENDER_PER_JOB_MICROUSD?: string;
  VIDEO_RENDER_COST_MODEL?: string;
}

type DispatchJobRow = {
  id: string;
  kind: "preview" | "final";
  status: string;
  provider_job_id: string | null;
};

type ReconcileJobRow = DispatchJobRow & {
  output_asset_id: string;
  cover_asset_id: string | null;
  updated_at: string;
};

const MAX_DISPATCH_ATTEMPTS = 5;
const PROVIDER = "cloudflare-containers";

export class VideoRenderContainer extends Container<Env> {
  sleepAfter = "10s";
  enableInternet = true;

  override onStart(): void {
    console.log(JSON.stringify({ event: "video_render_container_started" }));
  }

  override onStop({ exitCode, reason }: { exitCode: number; reason: string }): void {
    console.log(JSON.stringify({
      event: "video_render_container_stopped",
      exitCode,
      reason,
    }));
  }

  override onError(error: unknown): void {
    console.error(JSON.stringify({
      event: "video_render_container_error",
      error: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
  }

  override async onActivityExpired(): Promise<void> {
    await this.destroy();
  }
}

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
    ctx.waitUntil(runScheduledOperations(env));
  },
};

async function dispatchJob(
  env: Env,
  provider: VideoRenderProvider,
  jobId: string
): Promise<"submitted" | "ignored" | "retry"> {
  const pending = await env.DB.prepare(
    `SELECT id, kind, status, provider_job_id FROM render_jobs WHERE id = ?1`
  )
    .bind(jobId)
    .first<DispatchJobRow>();
  if (!pending) return "ignored";
  if (pending.status === "canceled" && pending.provider_job_id) {
    await provider.cancel(pending.provider_job_id);
    return "ignored";
  }
  if (pending.status !== "queued") return "ignored";
  if (await atContainerCapacity(env)) return "retry";
  const claimed = await env.DB.prepare(
    `UPDATE render_jobs
        SET status = 'preparing', provider = ?2, attempt = attempt + 1,
            error_code = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1
        AND status = 'queued'
        AND provider_job_id IS NULL`
  )
    .bind(jobId, PROVIDER)
    .run();
  if (!claimed.meta?.changes) {
    const current = await env.DB.prepare(
      `SELECT id, kind, status, provider_job_id FROM render_jobs WHERE id = ?1`
    )
      .bind(jobId)
      .first<DispatchJobRow>();
    if (!current) return "ignored";
    if (current.status === "canceled" && current.provider_job_id) {
      await provider.cancel(current.provider_job_id);
      return "ignored";
    }
    return current.status === "queued" ? "retry" : "ignored";
  }

  const claimedJob = await env.DB.prepare(
    `SELECT id, kind, status, provider_job_id FROM render_jobs WHERE id = ?1`
  )
    .bind(jobId)
    .first<DispatchJobRow>();
  if (!claimedJob) return "ignored";
  const jobToken = await createScopedJobToken(env.VIDEO_WORKER_SIGNING_SECRET, jobId);
  const providerJobId = await provider.submit({
    jobId,
    jobToken,
    internalBaseUrl: env.SCRIBIX_INTERNAL_URL.replace(/\/$/, ""),
  }, claimedJob.kind);
  let updated: D1Result;
  try {
    updated = await env.DB.prepare(
      `UPDATE render_jobs
          SET provider_job_id = ?1, provider_submitted_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?2
          AND status IN ('preparing', 'running', 'uploading', 'completed')
          AND provider_job_id IS NULL`
    )
      .bind(providerJobId, jobId)
      .run();
  } catch (error) {
    await provider.cancel(providerJobId).catch(() => undefined);
    throw error;
  }
  if (!updated.meta?.changes) {
    console.error(JSON.stringify({
      event: "video_dispatch_provider_job_unattached",
      jobId,
      providerJobId,
    }));
    await provider.cancel(providerJobId);
    await env.DB.prepare(
      `UPDATE render_jobs
          SET status = 'queued', provider = NULL, queued_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND status = 'preparing' AND provider_job_id IS NULL`
    )
      .bind(jobId)
      .run();
    return "retry";
  }
  return "submitted";
}

async function reconcileJobs(env: Env): Promise<void> {
  const staleUndispatched = await env.DB.prepare(
    `SELECT id
       FROM render_jobs
      WHERE provider_job_id IS NULL
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
    `SELECT id, kind, status, provider_job_id, output_asset_id, cover_asset_id, updated_at
       FROM render_jobs
      WHERE provider = ?1
        AND provider_job_id IS NOT NULL
        AND status IN ('preparing', 'running', 'uploading')
      ORDER BY updated_at ASC
      LIMIT 100`
  ).bind(PROVIDER).all<ReconcileJobRow>();
  if (active.results.length === 0) return;
  const states = await providerFor(env).describe(
    active.results.flatMap((job) => job.provider_job_id ? [job.provider_job_id] : [])
  );
  for (const job of active.results) {
    const state = job.provider_job_id ? states.get(job.provider_job_id) : undefined;
    if (!state) {
      if (staleTimestamp(job.updated_at, 15 * 60 * 1000)) {
        await failReconciledJob(env.DB, job, "provider_unavailable");
      }
      continue;
    }
    if (state === "failed" || (state === "succeeded" && staleTimestamp(job.updated_at, 2 * 60 * 1000))) {
      await failReconciledJob(
        env.DB,
        job,
        state === "failed" ? "render_failed" : "upload_failed"
      );
      continue;
    }
    // A successful provider job should be completed by its signed callback. Do
    // not refresh updated_at here: it is the recovery clock when that callback
    // never arrives.
    if (state === "succeeded") continue;
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

async function runScheduledOperations(env: Env): Promise<void> {
  await reconcileJobs(env);
  await recordRenderCosts(env);
  await emitRenderMetrics(env.DB);
}

async function recordRenderCosts(env: Env): Promise<void> {
  const rates = parseRenderCostRates(env);
  if (!rates) {
    console.warn(JSON.stringify({ event: "video_render_cost_rates_missing" }));
    return;
  }
  const rows = await env.DB.prepare(
    `SELECT id, kind,
            CAST((julianday(completed_at) - julianday(provider_submitted_at)) * 86400000 AS INTEGER) AS duration_ms
       FROM render_jobs
      WHERE status = 'completed'
        AND provider_submitted_at IS NOT NULL
        AND completed_at IS NOT NULL
        AND estimated_cost_microusd IS NULL
      ORDER BY completed_at ASC
      LIMIT 100`
  ).all<{ id: string; kind: "preview" | "final"; duration_ms: number }>();
  for (const row of rows.results) {
    const billableDurationMs = Math.max(1_000, Math.round(row.duration_ms));
    const estimatedCostMicrousd = estimateRenderCost(row.kind, billableDurationMs, rates);
    await env.DB.prepare(
      `UPDATE render_jobs
          SET billable_duration_ms = ?1, estimated_cost_microusd = ?2,
              cost_model = ?3, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?4 AND status = 'completed' AND estimated_cost_microusd IS NULL`
    )
      .bind(billableDurationMs, estimatedCostMicrousd, rates.model, row.id)
      .run();
  }
  if (rows.results.length > 0) {
    console.log(JSON.stringify({ event: "video_render_costs_recorded", count: rows.results.length, model: rates.model }));
  }
}

type MetricJobRow = {
  kind: "preview" | "final";
  status: string;
  attempt: number;
  error_code: string | null;
  queued_at: string | null;
  started_at: string | null;
  upload_started_at: string | null;
  completed_at: string | null;
  estimated_cost_microusd: number | null;
};

async function emitRenderMetrics(db: D1Database): Promise<void> {
  const [recent, active] = await Promise.all([
    db.prepare(
      `SELECT kind, status, attempt, error_code, queued_at, started_at,
              upload_started_at, completed_at, estimated_cost_microusd
         FROM render_jobs
        WHERE created_at >= datetime('now', '-1 day')
        ORDER BY created_at DESC
        LIMIT 1000`
    ).all<MetricJobRow>(),
    db.prepare(
      `SELECT status, COUNT(*) AS count
         FROM render_jobs
        WHERE status IN ('queued', 'preparing', 'running', 'uploading')
        GROUP BY status`
    ).all<{ status: string; count: number }>(),
  ]);
  const terminal = recent.results.filter((job) => ["completed", "failed"].includes(job.status));
  const completed = terminal.filter((job) => job.status === "completed");
  const startLatency = completed.flatMap((job) => durationBetween(job.queued_at, job.started_at));
  const renderLatency = completed.flatMap((job) => (
    durationBetween(job.started_at, job.upload_started_at ?? job.completed_at)
  ));
  const totalLatency = completed.flatMap((job) => durationBetween(job.queued_at, job.completed_at));
  const errorCategories = terminal.reduce<Record<string, number>>((counts, job) => {
    const category = renderErrorCategory(job.error_code as Parameters<typeof renderErrorCategory>[0]);
    if (category !== "none") counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});
  console.log(JSON.stringify({
    event: "video_render_metrics",
    window: "24h",
    sampleSize: recent.results.length,
    queueDepth: Object.fromEntries(active.results.map((row) => [row.status, row.count])),
    completed: completed.length,
    failed: terminal.length - completed.length,
    successRate: terminal.length > 0 ? completed.length / terminal.length : null,
    retryRate: terminal.length > 0
      ? terminal.filter((job) => job.attempt > 1).length / terminal.length
      : null,
    startLatencyMs: { p50: percentile(startLatency, 0.5), p95: percentile(startLatency, 0.95) },
    renderLatencyMs: { p50: percentile(renderLatency, 0.5), p95: percentile(renderLatency, 0.95) },
    totalLatencyMs: { p50: percentile(totalLatency, 0.5), p95: percentile(totalLatency, 0.95) },
    estimatedCostMicrousd: completed.reduce((sum, job) => sum + (job.estimated_cost_microusd ?? 0), 0),
    errorCategories,
  }));
}

async function markDispatchError(
  db: D1Database,
  jobId: string,
  permanent: boolean
): Promise<void> {
  const current = await db.prepare(
    `SELECT status FROM render_jobs WHERE id = ?1`
  )
    .bind(jobId)
    .first<{ status: string }>();
  if (current?.status === "canceled") return;
  if (!permanent) {
    await db.prepare(
      `UPDATE render_jobs
          SET status = 'queued', provider = NULL, provider_job_id = NULL,
              error_code = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND status = 'preparing'`
    )
      .bind(jobId)
      .run();
    return;
  }
  const job = await db.prepare(
    `SELECT id, kind, status, provider_job_id, output_asset_id, cover_asset_id, updated_at
       FROM render_jobs WHERE id = ?1`
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
        WHERE id IN (?1, ?2) AND status <> 'ready'`
    ).bind(job.output_asset_id, job.cover_asset_id),
    db.prepare(
      `UPDATE render_jobs
          SET status = 'failed', error_code = ?1,
              completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?2 AND status NOT IN ('completed', 'canceled')`
    ).bind(errorCode, job.id),
  ]);
  if (job.kind === "final") {
    await recordServerRenderEvent(db, job.id, "render_failed").catch(() => undefined);
  }
}

function providerFor(env: Env): VideoRenderProvider {
  return new CloudflareContainerRenderProvider(env.VIDEO_RENDER_CONTAINERS);
}

async function atContainerCapacity(env: Env): Promise<boolean> {
  const configured = Number(env.VIDEO_RENDER_MAX_CONTAINERS ?? 3);
  const limit = Number.isInteger(configured) && configured > 0
    ? Math.min(configured, 100)
    : 3;
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count
       FROM render_jobs
      WHERE provider = ?1
        AND status IN ('preparing', 'running', 'uploading')`
  ).bind(PROVIDER).first<{ count: number }>();
  return (row?.count ?? 0) >= limit;
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

function staleTimestamp(value: string, ageMs: number): boolean {
  const timestamp = Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isFinite(timestamp) && timestamp < Date.now() - ageMs;
}

function durationBetween(start: string | null, end: string | null): number[] {
  if (!start || !end) return [];
  const startMs = sqliteTimestamp(start);
  const endMs = sqliteTimestamp(end);
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
    ? [endMs - startMs]
    : [];
}

function sqliteTimestamp(value: string): number {
  return Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}
