import { presignGet, presignPut } from "@/lib/r2";
import {
  FINAL_RENDER_URL_TTL_SECONDS,
  FINAL_VIDEO_PRESET,
  RENDER_ERROR_CODES,
  VIDEO_WORKSPACE_SCHEMA_VERSION,
  edlTimelineDurationMs,
  type FinalJobLease,
  type FinalJobResult,
  type PreviewJobFailure,
  type RenderErrorCode,
} from "./contracts";
import { validateEdl, validateRenderSpec } from "./validation";

type FinalJobRow = {
  id: string;
  user_id: string;
  project_id: string;
  status: string;
  preset_id: string;
  edl_json: string;
  render_spec_json: string;
  source_r2_key: string;
  source_status: string;
  source_expires_at: string | null;
  source_duration_ms: number | null;
  output_asset_id: string;
  output_r2_key: string;
  output_status: string;
  cover_asset_id: string;
  cover_r2_key: string;
  cover_status: string;
};

export async function renderJobKind(
  db: D1Database,
  jobId: string
): Promise<"preview" | "final" | null> {
  const row = await db.prepare(`SELECT kind FROM render_jobs WHERE id = ?1`)
    .bind(jobId)
    .first<{ kind: "preview" | "final" }>();
  return row?.kind ?? null;
}

export async function leaseFinalJob(
  db: D1Database,
  jobId: string
): Promise<
  | { ok: true; lease: FinalJobLease }
  | { ok: false; error: "job_not_found" | "job_not_available" | "source_video_missing" | "asset_missing" | "invalid_render_spec" }
> {
  const job = await finalJob(db, jobId);
  if (!job) return { ok: false, error: "job_not_found" };
  if (!["preparing", "running"].includes(job.status)) {
    return { ok: false, error: "job_not_available" };
  }
  if (job.source_status !== "ready" || sourceExpired(job.source_expires_at)) {
    await failFinalJob(db, jobId, "invalid_source");
    return { ok: false, error: "source_video_missing" };
  }
  if (
    !job.output_r2_key || !job.cover_r2_key ||
    !["pending", "uploading"].includes(job.output_status) ||
    !["pending", "uploading"].includes(job.cover_status)
  ) {
    await failFinalJob(db, jobId, "asset_missing");
    return { ok: false, error: "asset_missing" };
  }
  let edlInput: unknown;
  let renderSpecInput: unknown;
  try {
    edlInput = JSON.parse(job.edl_json);
    renderSpecInput = JSON.parse(job.render_spec_json);
  } catch {
    await failFinalJob(db, jobId, "invalid_render_spec");
    return { ok: false, error: "invalid_render_spec" };
  }
  const edlResult = validateEdl(edlInput, {
    sourceDurationMs: job.source_duration_ms ?? undefined,
  });
  if (!edlResult.success) {
    await failFinalJob(db, jobId, "invalid_edl");
    return { ok: false, error: "invalid_render_spec" };
  }
  const renderSpecResult = validateRenderSpec(renderSpecInput, edlResult.data);
  if (!renderSpecResult.success) {
    await failFinalJob(db, jobId, "invalid_render_spec");
    return { ok: false, error: "invalid_render_spec" };
  }
  const [logoKey, fontKey] = await Promise.all([
    renderSpecResult.data.brand.logoAssetId
      ? ownedAssetKey(db, job.user_id, job.project_id, renderSpecResult.data.brand.logoAssetId, "logo")
      : null,
    renderSpecResult.data.captions.fontAssetId
      ? ownedAssetKey(db, job.user_id, job.project_id, renderSpecResult.data.captions.fontAssetId, "font")
      : null,
  ]);
  if (
    (renderSpecResult.data.brand.logoAssetId && !logoKey) ||
    (renderSpecResult.data.captions.fontAssetId && !fontKey)
  ) {
    await failFinalJob(db, jobId, "asset_missing");
    return { ok: false, error: "asset_missing" };
  }
  const claimed = await db.prepare(
    `UPDATE render_jobs
        SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1 AND kind = 'final' AND status IN ('preparing', 'running')`
  )
    .bind(jobId)
    .run();
  if (!claimed.meta?.changes) return { ok: false, error: "job_not_available" };
  const [sourceUrl, outputVideoUrl, outputCoverUrl, logoUrl, fontUrl] = await Promise.all([
    presignGet(job.source_r2_key, FINAL_RENDER_URL_TTL_SECONDS),
    presignPut(job.output_r2_key, FINAL_RENDER_URL_TTL_SECONDS),
    presignPut(job.cover_r2_key, FINAL_RENDER_URL_TTL_SECONDS),
    logoKey ? presignGet(logoKey, FINAL_RENDER_URL_TTL_SECONDS) : null,
    fontKey ? presignGet(fontKey, FINAL_RENDER_URL_TTL_SECONDS) : null,
  ]);
  return {
    ok: true,
    lease: {
      schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION,
      jobId,
      kind: "final",
      sourceUrl,
      outputVideoUrl,
      outputCoverUrl,
      logoUrl,
      fontUrl,
      urlsExpireInSec: FINAL_RENDER_URL_TTL_SECONDS,
      edl: edlResult.data,
      renderSpec: renderSpecResult.data,
      preset: FINAL_VIDEO_PRESET,
    },
  };
}

export async function markFinalJobUploading(db: D1Database, jobId: string): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE render_jobs SET status = 'uploading', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1 AND kind = 'final' AND status IN ('running', 'uploading')`
  )
    .bind(jobId)
    .run();
  if (result.meta?.changes) {
    await db.prepare(
      `UPDATE media_assets SET status = 'uploading'
        WHERE id IN (
          SELECT output_asset_id FROM render_jobs WHERE id = ?1
          UNION ALL
          SELECT cover_asset_id FROM render_jobs WHERE id = ?1
        ) AND status IN ('pending', 'uploading')`
    )
      .bind(jobId)
      .run();
  }
  return Boolean(result.meta?.changes);
}

export async function recordFinalJobResult(
  db: D1Database,
  bucket: R2Bucket,
  jobId: string,
  result: FinalJobResult | PreviewJobFailure
): Promise<{ ok: true } | { ok: false; error: string }> {
  const job = await finalJob(db, jobId);
  if (!job) return { ok: false, error: "job_not_found" };
  if (job.status === "completed" && result.status === "completed") return { ok: true };
  if (result.status === "failed") {
    if (!(RENDER_ERROR_CODES as readonly string[]).includes(result.errorCode)) {
      return { ok: false, error: "invalid_error_code" };
    }
    await failFinalJob(db, jobId, result.errorCode);
    return { ok: true };
  }
  if (!["running", "uploading"].includes(job.status)) {
    return { ok: false, error: "job_not_available" };
  }
  const expectedDurationMs = edlTimelineDurationMs(JSON.parse(job.edl_json));
  const output = result.output;
  if (
    output.video.width !== FINAL_VIDEO_PRESET.width ||
    output.video.height !== FINAL_VIDEO_PRESET.height ||
    output.video.videoCodec !== "h264" ||
    output.video.audioCodec !== "aac" ||
    Math.abs(output.video.durationMs - expectedDurationMs) > 1_000 ||
    output.video.bytes <= 0 ||
    output.cover.bytes <= 0 ||
    output.cover.width !== FINAL_VIDEO_PRESET.width ||
    output.cover.height !== FINAL_VIDEO_PRESET.height ||
    output.cover.mimeType !== "image/jpeg"
  ) {
    await failFinalJob(db, jobId, "render_failed");
    return { ok: false, error: "render_failed" };
  }
  const [videoObject, coverObject] = await Promise.all([
    bucket.head(job.output_r2_key),
    bucket.head(job.cover_r2_key),
  ]);
  if (!videoObject || !coverObject || videoObject.size <= 0 || coverObject.size <= 0) {
    await failFinalJob(db, jobId, "upload_failed");
    return { ok: false, error: "upload_failed" };
  }
  await db.batch([
    db.prepare(
      `UPDATE media_assets
          SET status = 'ready', bytes = ?1, duration_ms = ?2, width = ?3, height = ?4
        WHERE id = ?5 AND status IN ('pending', 'uploading')`
    ).bind(videoObject.size, output.video.durationMs, output.video.width, output.video.height, job.output_asset_id),
    db.prepare(
      `UPDATE media_assets
          SET status = 'ready', bytes = ?1, width = ?2, height = ?3
        WHERE id = ?4 AND status IN ('pending', 'uploading')`
    ).bind(coverObject.size, output.cover.width, output.cover.height, job.cover_asset_id),
    db.prepare(
      `UPDATE render_jobs
          SET status = 'completed', error_code = NULL,
              completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND kind = 'final' AND status IN ('running', 'uploading')`
    ).bind(jobId),
    db.prepare(
      `UPDATE video_projects SET status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND user_id = ?2
          AND active_project_version_id = (
            SELECT project_version_id FROM render_jobs WHERE id = ?3
          )
          AND deleted_at IS NULL`
    ).bind(job.project_id, job.user_id, jobId),
  ]);
  return { ok: true };
}

async function finalJob(db: D1Database, jobId: string): Promise<FinalJobRow | null> {
  return db.prepare(
    `SELECT j.id, j.user_id, j.project_id, j.status, j.preset_id,
            v.edl_json, v.render_spec_json,
            source.r2_key AS source_r2_key, source.status AS source_status,
            source.expires_at AS source_expires_at,
            source.duration_ms AS source_duration_ms,
            output.id AS output_asset_id, output.r2_key AS output_r2_key,
            output.status AS output_status,
            cover.id AS cover_asset_id, cover.r2_key AS cover_r2_key,
            cover.status AS cover_status
       FROM render_jobs j
       JOIN video_projects p
         ON p.id = j.project_id AND p.user_id = j.user_id
       JOIN project_versions v
         ON v.id = j.project_version_id AND v.user_id = j.user_id
       JOIN media_assets source
         ON source.id = p.source_asset_id AND source.user_id = j.user_id
       JOIN media_assets output
         ON output.id = j.output_asset_id AND output.user_id = j.user_id
       JOIN media_assets cover
         ON cover.id = j.cover_asset_id AND cover.user_id = j.user_id
      WHERE j.id = ?1 AND j.kind = 'final' AND p.deleted_at IS NULL
        AND source.deleted_at IS NULL AND output.deleted_at IS NULL
        AND cover.deleted_at IS NULL`
  )
    .bind(jobId)
    .first<FinalJobRow>();
}

async function ownedAssetKey(
  db: D1Database,
  userId: string,
  projectId: string,
  assetId: string,
  kind: "logo" | "font"
): Promise<string | null> {
  const row = await db.prepare(
    `SELECT r2_key FROM media_assets
      WHERE id = ?1 AND user_id = ?2 AND project_id = ?3 AND kind = ?4
        AND status = 'ready' AND deleted_at IS NULL AND r2_key IS NOT NULL`
  )
    .bind(assetId, userId, projectId, kind)
    .first<{ r2_key: string }>();
  return row?.r2_key ?? null;
}

async function failFinalJob(db: D1Database, jobId: string, errorCode: RenderErrorCode): Promise<void> {
  await db.batch([
    db.prepare(
      `UPDATE media_assets SET status = 'failed'
        WHERE id IN (
          SELECT output_asset_id FROM render_jobs WHERE id = ?1
          UNION ALL
          SELECT cover_asset_id FROM render_jobs WHERE id = ?1
        ) AND status <> 'ready'`
    ).bind(jobId),
    db.prepare(
      `UPDATE render_jobs
          SET status = 'failed', error_code = ?1,
              completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?2 AND kind = 'final' AND status NOT IN ('completed', 'canceled')`
    ).bind(errorCode, jobId),
    db.prepare(
      `UPDATE video_projects
          SET status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT project_id FROM render_jobs WHERE id = ?1)
          AND user_id = (SELECT user_id FROM render_jobs WHERE id = ?1)
          AND active_project_version_id = (
            SELECT project_version_id FROM render_jobs WHERE id = ?1
          )
          AND deleted_at IS NULL`
    ).bind(jobId),
  ]);
}

function sourceExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const value = expiresAt.includes("T") ? expiresAt : `${expiresAt.replace(" ", "T")}Z`;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}
