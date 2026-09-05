import { newId } from "@/lib/ids";
import { presignGet } from "@/lib/r2";
import {
  FINAL_VIDEO_PRESET,
  VIDEO_WORKSPACE_LIMITS,
  VIDEO_WORKSPACE_SCHEMA_VERSION,
  type RenderDispatchMessage,
} from "./contracts";
import { snapshotProjectDraft } from "./editor";
import { VideoWorkspaceR2 } from "./r2-keys";
import { recordServerRenderEvent } from "./events";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;

type FinalProjectRow = {
  id: string;
  draft_candidate_id: string | null;
  draft_revision: number;
  draft_edl_json: string | null;
  draft_render_spec_json: string | null;
  active_project_version_id: string | null;
  active_candidate_id: string | null;
  active_edl_json: string | null;
  active_render_spec_json: string | null;
  source_status: string | null;
  source_expires_at: string | null;
};

export type FinalRenderSummary = {
  id: string;
  candidateId: string | null;
  projectVersionId: string;
  version: number;
  isCurrent: boolean;
  status: string;
  attempt: number;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  videoUrl: string | null;
  coverUrl: string | null;
  expiresInSec: number | null;
};

export type CreateFinalRenderResult =
  | { ok: true; render: FinalRenderSummary; existing: boolean }
  | {
      ok: false;
      error:
        | "project_not_found"
        | "source_video_missing"
        | "draft_missing"
        | "draft_conflict"
        | "invalid_idempotency_key"
        | "idempotency_conflict"
        | "render_concurrency_limit"
        | "render_daily_limit";
      revision?: number;
    };

export async function createFinalRender(
  db: D1Database,
  queue: Queue<RenderDispatchMessage>,
  userId: string,
  projectId: string,
  candidateId: string,
  expectedRevision: number,
  idempotencyKey: string
): Promise<CreateFinalRenderResult> {
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return { ok: false, error: "invalid_idempotency_key" };
  }
  const idempotent = await finalJobByIdempotency(db, userId, idempotencyKey);
  if (idempotent) {
    if (idempotent.project_id !== projectId || idempotent.candidate_id !== candidateId) {
      return { ok: false, error: "idempotency_conflict" };
    }
    return { ok: true, render: await finalRenderSummary(db, userId, idempotent.id), existing: true };
  }
  const project = await finalProject(db, userId, projectId);
  if (!project) return { ok: false, error: "project_not_found" };
  if (project.source_status !== "ready" || sourceExpired(project.source_expires_at)) {
    return { ok: false, error: "source_video_missing" };
  }
  if (
    project.draft_candidate_id !== candidateId ||
    !project.draft_edl_json ||
    !project.draft_render_spec_json
  ) {
    return { ok: false, error: "draft_missing" };
  }
  if (project.draft_revision !== expectedRevision) {
    return { ok: false, error: "draft_conflict", revision: project.draft_revision };
  }

  const usage = await db.prepare(
    `SELECT
       SUM(CASE WHEN status IN ('queued', 'preparing', 'running', 'uploading') THEN 1 ELSE 0 END) AS active_jobs,
       SUM(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS daily_jobs
       FROM render_jobs
      WHERE user_id = ?1 AND kind = 'final'`
  )
    .bind(userId)
    .first<{ active_jobs: number | null; daily_jobs: number | null }>();
  if ((usage?.active_jobs ?? 0) >= VIDEO_WORKSPACE_LIMITS.maxActiveFinalJobsPerUser) {
    return { ok: false, error: "render_concurrency_limit" };
  }
  if ((usage?.daily_jobs ?? 0) >= VIDEO_WORKSPACE_LIMITS.maxFinalJobsPerUserPerDay) {
    return { ok: false, error: "render_daily_limit" };
  }

  let projectVersionId = project.active_project_version_id;
  if (
    !projectVersionId ||
    project.active_candidate_id !== candidateId ||
    project.active_edl_json !== project.draft_edl_json ||
    project.active_render_spec_json !== project.draft_render_spec_json
  ) {
    const snapshot = await snapshotProjectDraft(
      db,
      userId,
      projectId,
      candidateId,
      expectedRevision
    );
    if (!snapshot.ok) {
      return {
        ok: false,
        error: snapshot.error === "draft_conflict" ? "draft_conflict" : "draft_missing",
        revision: snapshot.revision,
      };
    }
    projectVersionId = snapshot.projectVersionId;
  }

  const reusable = await db.prepare(
    `SELECT j.id
       FROM render_jobs j
       JOIN project_versions v
         ON v.id = j.project_version_id AND v.user_id = j.user_id
       JOIN media_assets video
         ON video.id = j.output_asset_id AND video.user_id = j.user_id
       JOIN media_assets cover
         ON cover.id = j.cover_asset_id AND cover.user_id = j.user_id
      WHERE j.user_id = ?1
        AND j.project_id = ?2
        AND j.project_version_id = ?3
        AND v.candidate_id = ?4
        AND j.kind = 'final'
        AND j.preset_id = ?5
        AND j.status NOT IN ('failed', 'canceled')
        AND j.superseded_at IS NULL
        AND video.status <> 'deleted'
        AND video.deleted_at IS NULL
        AND (video.expires_at IS NULL OR video.expires_at > CURRENT_TIMESTAMP)
        AND cover.status <> 'deleted'
        AND cover.deleted_at IS NULL
        AND (cover.expires_at IS NULL OR cover.expires_at > CURRENT_TIMESTAMP)
      ORDER BY j.created_at DESC
      LIMIT 1`
  )
    .bind(userId, projectId, projectVersionId, candidateId, FINAL_VIDEO_PRESET.id)
    .first<{ id: string }>();
  if (reusable) {
    return { ok: true, render: await finalRenderSummary(db, userId, reusable.id), existing: true };
  }

  const jobId = newId();
  const videoAssetId = newId();
  const coverAssetId = newId();
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO media_assets
           (id, user_id, project_id, kind, r2_key, mime_type, status)
         VALUES (?1, ?2, ?3, 'final_video', ?4, 'video/mp4', 'pending')`
      ).bind(
        videoAssetId,
        userId,
        projectId,
        VideoWorkspaceR2.finalVideoKey(userId, projectId, jobId)
      ),
      db.prepare(
        `INSERT INTO media_assets
           (id, user_id, project_id, kind, r2_key, mime_type, status)
         VALUES (?1, ?2, ?3, 'cover', ?4, 'image/jpeg', 'pending')`
      ).bind(
        coverAssetId,
        userId,
        projectId,
        VideoWorkspaceR2.coverKey(userId, projectId, jobId)
      ),
      db.prepare(
        `INSERT INTO render_jobs
           (id, user_id, project_id, project_version_id, kind, preset_id,
            scope_key, status, idempotency_key, output_asset_id, cover_asset_id,
            queued_at)
         VALUES (?1, ?2, ?3, ?4, 'final', ?5, 'default', 'queued', ?6, ?7, ?8,
                 CURRENT_TIMESTAMP)`
      ).bind(
        jobId,
        userId,
        projectId,
        projectVersionId,
        FINAL_VIDEO_PRESET.id,
        idempotencyKey,
        videoAssetId,
        coverAssetId
      ),
      db.prepare(
        `UPDATE video_projects
            SET status = 'rendering', active_project_version_id = ?1,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?2 AND user_id = ?3 AND deleted_at IS NULL`
      ).bind(projectVersionId, projectId, userId),
    ]);
  } catch (error) {
    const raced = await finalJobByIdempotency(db, userId, idempotencyKey);
    if (!raced) {
      const limit = databaseLimitError(error);
      if (limit) return { ok: false, error: limit };
      throw error;
    }
    if (raced.project_id !== projectId || raced.candidate_id !== candidateId) {
      return { ok: false, error: "idempotency_conflict" };
    }
    return { ok: true, render: await finalRenderSummary(db, userId, raced.id), existing: true };
  }
  await recordServerRenderEvent(db, jobId, "render_requested").catch(() => undefined);
  await queue.send({ schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION, jobId });
  return { ok: true, render: await finalRenderSummary(db, userId, jobId), existing: false };
}

export async function listFinalRenders(
  db: D1Database,
  userId: string,
  projectId: string
): Promise<FinalRenderSummary[]> {
  const { results } = await db.prepare(
    `SELECT j.id
       FROM render_jobs j
       JOIN video_projects p
         ON p.id = j.project_id AND p.user_id = j.user_id
      WHERE j.user_id = ?1
        AND j.project_id = ?2
        AND j.kind = 'final'
        AND j.superseded_at IS NULL
        AND p.deleted_at IS NULL
      ORDER BY j.created_at DESC
      LIMIT 20`
  )
    .bind(userId, projectId)
    .all<{ id: string }>();
  return Promise.all(results.map((row) => finalRenderSummary(db, userId, row.id)));
}

export async function cancelFinalRender(
  db: D1Database,
  queue: Queue<RenderDispatchMessage>,
  userId: string,
  projectId: string,
  jobId: string
): Promise<{ ok: true } | { ok: false; error: "job_not_found" | "job_not_cancelable" }> {
  const job = await ownedFinalJob(db, userId, projectId, jobId);
  if (!job) return { ok: false, error: "job_not_found" };
  if (!["queued", "preparing", "running", "uploading"].includes(job.status)) {
    return { ok: false, error: "job_not_cancelable" };
  }
  await db.batch([
    db.prepare(
      `UPDATE render_jobs
          SET status = 'canceled', completed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND user_id = ?2
          AND status IN ('queued', 'preparing', 'running', 'uploading')`
    ).bind(jobId, userId),
    db.prepare(
      `UPDATE media_assets SET status = 'failed'
        WHERE id IN (?1, ?2) AND user_id = ?3 AND status <> 'ready'`
    ).bind(job.output_asset_id, job.cover_asset_id, userId),
    db.prepare(
      `UPDATE video_projects
          SET status = CASE
            WHEN EXISTS (
              SELECT 1 FROM render_jobs
               WHERE project_id = ?1 AND user_id = ?2
                 AND kind = 'final' AND status = 'completed'
                 AND superseded_at IS NULL
            ) THEN 'completed'
            ELSE 'editing'
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND user_id = ?2
          AND active_project_version_id = (
            SELECT project_version_id FROM render_jobs WHERE id = ?3
          )
          AND deleted_at IS NULL`
    ).bind(projectId, userId, jobId),
  ]);
  await queue.send({ schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION, jobId });
  return { ok: true };
}

export async function removeFinalRender(
  db: D1Database,
  bucket: R2Bucket,
  queue: Queue<RenderDispatchMessage>,
  userId: string,
  projectId: string,
  jobId: string
): Promise<
  | { ok: true; action: "canceled" | "deleted" }
  | { ok: false; error: "job_not_found" | "job_not_cancelable" }
> {
  const job = await ownedFinalJob(db, userId, projectId, jobId);
  if (!job) return { ok: false, error: "job_not_found" };
  if (["queued", "preparing", "running", "uploading"].includes(job.status)) {
    const canceled = await cancelFinalRender(db, queue, userId, projectId, jobId);
    return canceled.ok ? { ok: true, action: "canceled" } : canceled;
  }
  if (job.status !== "completed") {
    return { ok: false, error: "job_not_cancelable" };
  }

  const assets = await db.prepare(
    `SELECT id, r2_key
       FROM media_assets
      WHERE user_id = ?1
        AND id IN (?2, ?3)
        AND status = 'ready'
        AND deleted_at IS NULL`
  )
    .bind(userId, job.output_asset_id, job.cover_asset_id)
    .all<{ id: string; r2_key: string | null }>();
  const keys = assets.results.flatMap((asset) => asset.r2_key ? [asset.r2_key] : []);
  if (keys.length > 0) await bucket.delete(keys);
  await db.batch([
    db.prepare(
      `UPDATE media_assets
          SET status = 'deleted', r2_key = NULL, deleted_at = CURRENT_TIMESTAMP
        WHERE user_id = ?1 AND id IN (?2, ?3) AND deleted_at IS NULL`
    ).bind(userId, job.output_asset_id, job.cover_asset_id),
    db.prepare(
      `UPDATE render_jobs
          SET superseded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND user_id = ?2 AND project_id = ?3 AND kind = 'final'`
    ).bind(jobId, userId, projectId),
    db.prepare(
      `UPDATE video_projects
          SET status = CASE
                WHEN EXISTS (
                  SELECT 1 FROM render_jobs
                   WHERE project_id = ?1 AND user_id = ?2
                     AND kind = 'final' AND status = 'completed'
                     AND superseded_at IS NULL
                ) THEN 'completed'
                ELSE 'editing'
              END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
    ).bind(projectId, userId),
  ]);
  return { ok: true, action: "deleted" };
}

export async function retryFinalRender(
  db: D1Database,
  queue: Queue<RenderDispatchMessage>,
  userId: string,
  projectId: string,
  jobId: string
): Promise<{
  ok: true;
} | {
  ok: false;
  error: "job_not_found" | "job_not_retryable" | "render_concurrency_limit";
}> {
  const job = await ownedFinalJob(db, userId, projectId, jobId);
  if (!job) return { ok: false, error: "job_not_found" };
  if (!["failed", "canceled"].includes(job.status)) {
    return { ok: false, error: "job_not_retryable" };
  }
  try {
    await db.batch([
      db.prepare(
        `UPDATE render_jobs
          SET status = 'queued', provider = NULL, provider_job_id = NULL,
              error_code = NULL, queued_at = CURRENT_TIMESTAMP,
              provider_submitted_at = NULL, started_at = NULL,
              upload_started_at = NULL, completed_at = NULL,
              billable_duration_ms = NULL, estimated_cost_microusd = NULL,
              cost_model = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?1 AND user_id = ?2 AND status IN ('failed', 'canceled')`
      ).bind(jobId, userId),
      db.prepare(
        `UPDATE media_assets
          SET status = 'pending', bytes = NULL, duration_ms = NULL,
              width = NULL, height = NULL, deleted_at = NULL
          WHERE id IN (?1, ?2) AND user_id = ?3`
      ).bind(job.output_asset_id, job.cover_asset_id, userId),
      db.prepare(
        `UPDATE video_projects SET status = 'rendering', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?1 AND user_id = ?2
          AND active_project_version_id = (
            SELECT project_version_id FROM render_jobs WHERE id = ?3
          )
          AND deleted_at IS NULL`
      ).bind(projectId, userId, jobId),
    ]);
  } catch (error) {
    if (databaseLimitError(error) === "render_concurrency_limit") {
      return { ok: false, error: "render_concurrency_limit" };
    }
    throw error;
  }
  await queue.send({ schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION, jobId });
  return { ok: true };
}

async function finalRenderSummary(
  db: D1Database,
  userId: string,
  jobId: string
): Promise<FinalRenderSummary> {
  const row = await db.prepare(
    `SELECT j.id, v.candidate_id, j.project_version_id, v.version, j.status, j.attempt,
            j.error_code, j.created_at, j.completed_at,
            CASE
              WHEN candidate.draft_edl_json = v.edl_json
               AND candidate.draft_render_spec_json = v.render_spec_json
              THEN 1 ELSE 0
            END AS is_current,
            video.r2_key AS video_r2_key, video.status AS video_status,
            video.expires_at AS video_expires_at,
            cover.r2_key AS cover_r2_key, cover.status AS cover_status,
            cover.expires_at AS cover_expires_at
       FROM render_jobs j
       JOIN project_versions v
         ON v.id = j.project_version_id AND v.user_id = j.user_id
       LEFT JOIN clip_candidates candidate
         ON candidate.id = v.candidate_id
        AND candidate.user_id = j.user_id
        AND candidate.project_id = j.project_id
       JOIN media_assets video
         ON video.id = j.output_asset_id AND video.user_id = j.user_id
       JOIN media_assets cover
         ON cover.id = j.cover_asset_id AND cover.user_id = j.user_id
      WHERE j.id = ?1 AND j.user_id = ?2 AND j.kind = 'final'`
  )
    .bind(jobId, userId)
    .first<{
      id: string;
      candidate_id: string | null;
      project_version_id: string;
      version: number;
      is_current: number;
      status: string;
      attempt: number;
      error_code: string | null;
      created_at: string;
      completed_at: string | null;
      video_r2_key: string;
      video_status: string;
      video_expires_at: string | null;
      cover_r2_key: string;
      cover_status: string;
      cover_expires_at: string | null;
    }>();
  if (!row) throw new Error("final_render_not_found");
  const expiresAt = earliestTimestamp(row.video_expires_at, row.cover_expires_at);
  const ready = row.status === "completed" && row.video_status === "ready" &&
    row.cover_status === "ready" && !timestampExpired(expiresAt);
  const expiresInSec = ready ? 15 * 60 : null;
  const [videoUrl, coverUrl] = ready
    ? await Promise.all([
        presignGet(row.video_r2_key, expiresInSec as number),
        presignGet(row.cover_r2_key, expiresInSec as number),
      ])
    : [null, null];
  return {
    id: row.id,
    candidateId: row.candidate_id,
    projectVersionId: row.project_version_id,
    version: row.version,
    isCurrent: row.is_current === 1,
    status: row.status,
    attempt: row.attempt,
    errorCode: row.error_code,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    expiresAt,
    videoUrl,
    coverUrl,
    expiresInSec,
  };
}

function finalProject(db: D1Database, userId: string, projectId: string): Promise<FinalProjectRow | null> {
  return db.prepare(
    `SELECT p.id, p.draft_candidate_id, p.draft_revision, p.draft_edl_json,
            p.draft_render_spec_json, p.active_project_version_id,
            v.candidate_id AS active_candidate_id, v.edl_json AS active_edl_json,
            v.render_spec_json AS active_render_spec_json,
            source.status AS source_status, source.expires_at AS source_expires_at
       FROM video_projects p
       LEFT JOIN project_versions v
         ON v.id = p.active_project_version_id AND v.user_id = p.user_id
       LEFT JOIN media_assets source
         ON source.id = p.source_asset_id AND source.user_id = p.user_id
      WHERE p.id = ?1 AND p.user_id = ?2 AND p.deleted_at IS NULL`
  )
    .bind(projectId, userId)
    .first<FinalProjectRow>();
}

function finalJobByIdempotency(
  db: D1Database,
  userId: string,
  idempotencyKey: string
): Promise<{ id: string; project_id: string; candidate_id: string | null } | null> {
  return db.prepare(
    `SELECT j.id, j.project_id, v.candidate_id
       FROM render_jobs j
       JOIN project_versions v
         ON v.id = j.project_version_id AND v.user_id = j.user_id
      WHERE j.user_id = ?1 AND j.idempotency_key = ?2 AND j.kind = 'final'`
  )
    .bind(userId, idempotencyKey)
    .first<{ id: string; project_id: string; candidate_id: string | null }>();
}

function ownedFinalJob(
  db: D1Database,
  userId: string,
  projectId: string,
  jobId: string
): Promise<{
  id: string;
  status: string;
  output_asset_id: string;
  cover_asset_id: string;
} | null> {
  return db.prepare(
    `SELECT j.id, j.status, j.output_asset_id, j.cover_asset_id
       FROM render_jobs j
       JOIN video_projects p
         ON p.id = j.project_id AND p.user_id = j.user_id
      WHERE j.id = ?1 AND j.user_id = ?2 AND j.project_id = ?3
        AND j.kind = 'final' AND p.deleted_at IS NULL`
  )
    .bind(jobId, userId, projectId)
    .first<{
      id: string;
      status: string;
      output_asset_id: string;
      cover_asset_id: string;
    }>();
}

function sourceExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const value = expiresAt.includes("T") ? expiresAt : `${expiresAt.replace(" ", "T")}Z`;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function timestampExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const value = expiresAt.includes("T") ? expiresAt : `${expiresAt.replace(" ", "T")}Z`;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function earliestTimestamp(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left < right ? left : right;
}

function databaseLimitError(
  error: unknown
): "render_concurrency_limit" | "render_daily_limit" | null {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("render_concurrency_limit")) return "render_concurrency_limit";
  if (message.includes("render_daily_limit")) return "render_daily_limit";
  return null;
}
