import { presignGet, presignPut } from "@/lib/r2";
import {
  PREVIEW_PROXY_PRESET,
  PREVIEW_PROXY_URL_TTL_SECONDS,
  RENDER_ERROR_CODES,
  VIDEO_WORKSPACE_SCHEMA_VERSION,
  type PreviewJobFailure,
  type PreviewJobLease,
  type PreviewJobResult,
  type RenderErrorCode,
} from "./contracts";

type PreviewJobRow = {
  id: string;
  status: string;
  preset_id: string;
  segment_index: number;
  segment_id: string;
  source_start_ms: number;
  source_end_ms: number;
  proxy_source_start_ms: number;
  proxy_source_end_ms: number;
  source_r2_key: string;
  source_status: string;
  source_expires_at: string | null;
  output_asset_id: string;
  output_r2_key: string;
  output_status: string;
};

export type LeasePreviewJobResult =
  | { ok: true; lease: PreviewJobLease }
  | {
      ok: false;
      error: "job_not_found" | "job_not_available" | "source_video_missing" | "asset_missing";
    };

export async function leasePreviewJob(
  db: D1Database,
  jobId: string
): Promise<LeasePreviewJobResult> {
  const job = await previewJob(db, jobId);
  if (!job) return { ok: false, error: "job_not_found" };
  if (!["preparing", "running"].includes(job.status)) {
    return { ok: false, error: "job_not_available" };
  }
  if (
    job.source_status !== "ready" ||
    !job.source_r2_key ||
    sourceExpired(job.source_expires_at)
  ) {
    await failPreviewJob(db, jobId, "invalid_source");
    return { ok: false, error: "source_video_missing" };
  }
  if (!job.output_r2_key || !["pending", "uploading"].includes(job.output_status)) {
    await failPreviewJob(db, jobId, "asset_missing");
    return { ok: false, error: "asset_missing" };
  }
  const claimed = await db.prepare(
    `UPDATE render_jobs
        SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1 AND kind = 'preview' AND status IN ('preparing', 'running')`
  )
    .bind(jobId)
    .run();
  if (!claimed.meta?.changes) return { ok: false, error: "job_not_available" };

  const [sourceUrl, outputUrl] = await Promise.all([
    presignGet(job.source_r2_key, PREVIEW_PROXY_URL_TTL_SECONDS),
    presignPut(job.output_r2_key, PREVIEW_PROXY_URL_TTL_SECONDS),
  ]);
  return {
    ok: true,
    lease: {
      schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION,
      jobId,
      kind: "preview",
      sourceUrl,
      outputUrl,
      urlsExpireInSec: PREVIEW_PROXY_URL_TTL_SECONDS,
      segment: {
        id: job.segment_id,
        index: job.segment_index,
        sourceStartMs: job.source_start_ms,
        sourceEndMs: job.source_end_ms,
        proxySourceStartMs: job.proxy_source_start_ms,
        proxySourceEndMs: job.proxy_source_end_ms,
      },
      preset: PREVIEW_PROXY_PRESET,
    },
  };
}

export async function markPreviewJobUploading(
  db: D1Database,
  jobId: string
): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE render_jobs
        SET status = 'uploading', upload_started_at = COALESCE(upload_started_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1 AND kind = 'preview' AND status IN ('running', 'uploading')`
  )
    .bind(jobId)
    .run();
  if (result.meta?.changes) {
    await db.prepare(
      `UPDATE media_assets
          SET status = 'uploading'
        WHERE id = (SELECT output_asset_id FROM render_jobs WHERE id = ?1)
          AND status IN ('pending', 'uploading')`
    )
      .bind(jobId)
      .run();
  }
  return Boolean(result.meta?.changes);
}

export async function recordPreviewJobResult(
  db: D1Database,
  bucket: R2Bucket,
  jobId: string,
  result: PreviewJobResult | PreviewJobFailure
): Promise<{ ok: true } | { ok: false; error: string }> {
  const job = await previewJob(db, jobId);
  if (!job) return { ok: false, error: "job_not_found" };
  if (job.status === "completed" && result.status === "completed") return { ok: true };
  if (result.status === "failed") {
    if (!isRenderErrorCode(result.errorCode)) {
      return { ok: false, error: "invalid_error_code" };
    }
    await failPreviewJob(db, jobId, result.errorCode);
    return { ok: true };
  }
  if (!["running", "uploading"].includes(job.status)) {
    return { ok: false, error: "job_not_available" };
  }
  const validationError = validatePreviewOutput(job, result);
  if (validationError) {
    await failPreviewJob(db, jobId, validationError);
    return { ok: false, error: validationError };
  }
  const object = await bucket.head(job.output_r2_key);
  if (!object || object.size <= 0) {
    await failPreviewJob(db, jobId, "upload_failed");
    return { ok: false, error: "upload_failed" };
  }
  await db.batch([
    db.prepare(
      `UPDATE media_assets
          SET status = 'ready', bytes = ?1, duration_ms = ?2, width = ?3, height = ?4
        WHERE id = ?5 AND status IN ('pending', 'uploading')`
    ).bind(
      object.size,
      result.output.durationMs,
      result.output.width,
      result.output.height,
      job.output_asset_id
    ),
    db.prepare(
      `UPDATE render_jobs
          SET status = 'completed', error_code = NULL,
              completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1
          AND kind = 'preview'
          AND status IN ('running', 'uploading')`
    ).bind(jobId),
  ]);
  return { ok: true };
}

async function previewJob(db: D1Database, jobId: string): Promise<PreviewJobRow | null> {
  return db.prepare(
    `SELECT j.id, j.status, j.preset_id, j.segment_index, j.segment_id,
            j.source_start_ms, j.source_end_ms, j.proxy_source_start_ms,
            j.proxy_source_end_ms, source.r2_key AS source_r2_key,
            source.status AS source_status, source.expires_at AS source_expires_at,
            output.id AS output_asset_id, output.r2_key AS output_r2_key,
            output.status AS output_status
       FROM render_jobs j
       JOIN video_projects p
         ON p.id = j.project_id AND p.user_id = j.user_id
       JOIN clip_candidates c
         ON c.id = j.candidate_id
        AND c.project_id = j.project_id
        AND c.user_id = j.user_id
        AND c.status <> 'deleted'
       JOIN media_assets source
         ON source.id = p.source_asset_id AND source.user_id = j.user_id
       JOIN media_assets output
         ON output.id = j.output_asset_id AND output.user_id = j.user_id
      WHERE j.id = ?1
        AND j.kind = 'preview'
        AND p.deleted_at IS NULL
        AND source.deleted_at IS NULL
        AND output.deleted_at IS NULL`
  )
    .bind(jobId)
    .first<PreviewJobRow>();
}

async function failPreviewJob(
  db: D1Database,
  jobId: string,
  errorCode: RenderErrorCode
): Promise<void> {
  await db.batch([
    db.prepare(
      `UPDATE media_assets
          SET status = 'failed'
        WHERE id = (SELECT output_asset_id FROM render_jobs WHERE id = ?1)
          AND status <> 'ready'`
    ).bind(jobId),
    db.prepare(
      `UPDATE render_jobs
          SET status = 'failed', error_code = ?1,
              completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?2 AND kind = 'preview' AND status <> 'completed'`
    ).bind(errorCode, jobId),
  ]);
}

function validatePreviewOutput(
  job: PreviewJobRow,
  result: PreviewJobResult
): RenderErrorCode | null {
  const output = result.output;
  if (
    !Number.isInteger(output.bytes) || output.bytes <= 0 ||
    !Number.isInteger(output.durationMs) || output.durationMs <= 0 ||
    !Number.isInteger(output.width) || output.width <= 0 ||
    !Number.isInteger(output.height) || output.height <= 0
  ) {
    return "render_failed";
  }
  const expectedDurationMs = job.proxy_source_end_ms - job.proxy_source_start_ms;
  if (Math.abs(output.durationMs - expectedDurationMs) > 1_500) return "render_failed";
  if (Math.max(output.width, output.height) > PREVIEW_PROXY_PRESET.maxDimension) {
    return "render_failed";
  }
  if (output.videoCodec !== "h264" || (output.audioCodec !== "aac" && output.audioCodec !== null)) {
    return "unsupported_codec";
  }
  return null;
}

function isRenderErrorCode(value: string): value is RenderErrorCode {
  return (RENDER_ERROR_CODES as readonly string[]).includes(value);
}

function sourceExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const value = expiresAt.includes("T")
    ? expiresAt
    : `${expiresAt.replace(" ", "T")}Z`;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}
