import { newId } from "@/lib/ids";
import {
  PREVIEW_PROXY_AUTO_CANDIDATES,
  PREVIEW_PROXY_PRESET,
  PREVIEW_PROXY_RETENTION_DAYS,
  VIDEO_WORKSPACE_LIMITS,
  VIDEO_WORKSPACE_SCHEMA_VERSION,
  type ClipCandidate,
  type RenderDispatchMessage,
} from "./contracts";
import { VideoWorkspaceR2 } from "./r2-keys";

type PreviewCandidateRow = {
  id: string;
  rank: number;
  segments_json: string;
};

type PreviewProjectRow = {
  id: string;
  user_id: string;
  source_asset_id: string;
  source_duration_ms: number;
  source_status: string;
  source_expires_at: string | null;
};

export type CandidatePreview = {
  candidateId: string;
  status: "not_requested" | "queued" | "processing" | "ready" | "failed";
  segments: Array<{
    segmentIndex: number;
    jobId: string;
    jobStatus: string;
    assetId: string;
    assetStatus: string;
    sourceStartMs: number;
    sourceEndMs: number;
    proxySourceStartMs: number;
    proxySourceEndMs: number;
    proxyVersion: number;
  }>;
};

export type QueueCandidatePreviewsResult =
  | { ok: true; created: number; existing: number }
  | {
      ok: false;
      error: "project_not_found" | "source_video_missing" | "candidate_not_found";
    };

export type RebuildCandidatePreviewResult =
  | { ok: true; created: boolean; jobId: string }
  | {
      ok: false;
      error:
        | "project_not_found"
        | "source_video_missing"
        | "candidate_not_found"
        | "segment_not_found"
        | "invalid_segment_range";
    };

export async function queueAutomaticCandidatePreviews(
  db: D1Database,
  queue: Queue<RenderDispatchMessage>,
  userId: string,
  projectId: string
): Promise<QueueCandidatePreviewsResult> {
  const candidates = await candidateRows(db, userId, projectId, undefined);
  return queueCandidateRows(
    db,
    queue,
    userId,
    projectId,
    candidates.slice(0, PREVIEW_PROXY_AUTO_CANDIDATES)
  );
}

export async function queueCandidatePreviews(
  db: D1Database,
  queue: Queue<RenderDispatchMessage>,
  userId: string,
  projectId: string,
  candidateId: string
): Promise<QueueCandidatePreviewsResult> {
  const candidates = await candidateRows(db, userId, projectId, [candidateId]);
  if (candidates.length === 0) return { ok: false, error: "candidate_not_found" };
  return queueCandidateRows(db, queue, userId, projectId, candidates);
}

export async function rebuildCandidatePreviewSegment(
  db: D1Database,
  queue: Queue<RenderDispatchMessage>,
  userId: string,
  projectId: string,
  candidateId: string,
  segmentIndex: number,
  sourceStartMs: number,
  sourceEndMs: number
): Promise<RebuildCandidatePreviewResult> {
  if (
    !Number.isInteger(segmentIndex) || segmentIndex < 0 ||
    !Number.isInteger(sourceStartMs) || sourceStartMs < 0 ||
    !Number.isInteger(sourceEndMs) || sourceEndMs <= sourceStartMs ||
    sourceEndMs - sourceStartMs < VIDEO_WORKSPACE_LIMITS.minSegmentDurationMs ||
    sourceEndMs - sourceStartMs > VIDEO_WORKSPACE_LIMITS.maxSegmentDurationMs
  ) {
    return { ok: false, error: "invalid_segment_range" };
  }
  const project = await previewProject(db, userId, projectId);
  if (!project) return { ok: false, error: "project_not_found" };
  if (
    project.source_status !== "ready" ||
    sourceExpired(project.source_expires_at)
  ) {
    return { ok: false, error: "source_video_missing" };
  }
  if (sourceEndMs > project.source_duration_ms) {
    return { ok: false, error: "invalid_segment_range" };
  }
  const candidates = await candidateRows(db, userId, projectId, [candidateId]);
  if (candidates.length === 0) return { ok: false, error: "candidate_not_found" };
  const candidateSegments = parseSegments(candidates[0].segments_json);
  if (!candidateSegments[segmentIndex]) return { ok: false, error: "segment_not_found" };

  const latest = await db.prepare(
    `SELECT j.id, j.status, j.provider_job_id, j.proxy_source_start_ms,
            j.proxy_source_end_ms, j.proxy_version,
            a.r2_key, a.expires_at, a.deleted_at
       FROM render_jobs j
       JOIN media_assets a
         ON a.id = j.output_asset_id AND a.user_id = j.user_id
      WHERE j.user_id = ?1
        AND j.project_id = ?2
        AND j.candidate_id = ?3
        AND j.segment_index = ?4
        AND j.kind = 'preview'
      ORDER BY j.proxy_version DESC
      LIMIT 1`
  )
    .bind(userId, projectId, candidateId, segmentIndex)
    .first<{
      id: string;
      status: string;
      provider_job_id: string | null;
      proxy_source_start_ms: number;
      proxy_source_end_ms: number;
      proxy_version: number;
      r2_key: string | null;
      expires_at: string | null;
      deleted_at: string | null;
    }>();
  if (
    latest &&
    latest.r2_key &&
    !latest.deleted_at &&
    !sourceExpired(latest.expires_at) &&
    sourceStartMs >= latest.proxy_source_start_ms &&
    sourceEndMs <= latest.proxy_source_end_ms
  ) {
    if (latest.status === "failed") {
      const retried = await resetFailedPreviewJob(db, userId, latest.id);
      if (retried) {
        await queue.send({ schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION, jobId: latest.id });
      }
    } else if (latest.status === "queued" && !latest.provider_job_id) {
      await queue.send({ schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION, jobId: latest.id });
    }
    return { ok: true, created: false, jobId: latest.id };
  }

  const proxyVersion = (latest?.proxy_version ?? 0) + 1;
  const segmentId = `s${segmentIndex}`;
  const jobId = newId();
  const assetId = newId();
  const proxySourceStartMs = Math.max(
    0,
    sourceStartMs - PREVIEW_PROXY_PRESET.handleDurationMs
  );
  const proxySourceEndMs = Math.min(
    project.source_duration_ms,
    sourceEndMs + PREVIEW_PROXY_PRESET.handleDurationMs
  );
  const idempotencyKey = previewIdempotencyKey(
    projectId,
    candidateId,
    segmentIndex,
    proxyVersion
  );
  const r2Key = VideoWorkspaceR2.previewProxyKey(
    userId,
    projectId,
    candidateId,
    segmentId,
    proxyVersion
  );
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO media_assets
           (id, user_id, project_id, kind, r2_key, mime_type, status, expires_at)
         VALUES (?1, ?2, ?3, 'preview_proxy', ?4, 'video/mp4', 'pending', ?5)`
      ).bind(assetId, userId, projectId, r2Key, previewExpiresAt()),
      db.prepare(
        `INSERT INTO render_jobs
           (id, user_id, project_id, project_version_id, candidate_id,
            segment_index, segment_id, source_start_ms, source_end_ms,
            proxy_source_start_ms, proxy_source_end_ms, proxy_version,
            kind, preset_id, scope_key, status, idempotency_key,
            output_asset_id, queued_at)
         VALUES
           (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
            'preview', ?12, ?13, 'queued', ?14, ?15, CURRENT_TIMESTAMP)`
      ).bind(
        jobId,
        userId,
        projectId,
        candidateId,
        segmentIndex,
        segmentId,
        sourceStartMs,
        sourceEndMs,
        proxySourceStartMs,
        proxySourceEndMs,
        proxyVersion,
        PREVIEW_PROXY_PRESET.id,
        `candidate:${candidateId}:segment:${segmentIndex}:v${proxyVersion}`,
        idempotencyKey,
        assetId
      ),
    ]);
  } catch (error) {
    const raced = await db.prepare(
      `SELECT id FROM render_jobs WHERE user_id = ?1 AND idempotency_key = ?2`
    )
      .bind(userId, idempotencyKey)
      .first<{ id: string }>();
    if (!raced) throw error;
    return { ok: true, created: false, jobId: raced.id };
  }
  await queue.send({ schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION, jobId });
  return { ok: true, created: true, jobId };
}

async function queueCandidateRows(
  db: D1Database,
  queue: Queue<RenderDispatchMessage>,
  userId: string,
  projectId: string,
  candidates: PreviewCandidateRow[]
): Promise<QueueCandidatePreviewsResult> {
  const project = await previewProject(db, userId, projectId);
  if (!project) return { ok: false, error: "project_not_found" };
  if (
    project.source_status !== "ready" ||
    sourceExpired(project.source_expires_at)
  ) {
    return { ok: false, error: "source_video_missing" };
  }

  const messages: Array<{ body: RenderDispatchMessage; contentType: "json" }> = [];
  let existing = 0;
  for (const candidate of candidates) {
    const segments = parseSegments(candidate.segments_json);
    for (const [segmentIndex, segment] of segments.entries()) {
      const latest = await db.prepare(
        `SELECT j.id, j.status, j.provider_job_id, j.proxy_version,
                a.r2_key, a.expires_at, a.deleted_at
           FROM render_jobs j
           JOIN media_assets a
             ON a.id = j.output_asset_id AND a.user_id = j.user_id
          WHERE j.user_id = ?1
            AND j.project_id = ?2
            AND j.candidate_id = ?3
            AND j.segment_index = ?4
            AND j.kind = 'preview'
          ORDER BY j.proxy_version DESC
          LIMIT 1`
      )
        .bind(userId, projectId, candidate.id, segmentIndex)
        .first<{
          id: string;
          status: string;
          provider_job_id: string | null;
          proxy_version: number;
          r2_key: string | null;
          expires_at: string | null;
          deleted_at: string | null;
        }>();
      const latestAssetAvailable = Boolean(
        latest?.r2_key &&
        !latest.deleted_at &&
        !sourceExpired(latest.expires_at)
      );
      if (latest && latestAssetAvailable) {
        if (latest.status === "failed") {
          const retried = await resetFailedPreviewJob(db, userId, latest.id);
          if (retried) {
            messages.push(dispatchMessage(latest.id));
            continue;
          }
        }
        if (latest.status === "queued" && !latest.provider_job_id) {
          messages.push(dispatchMessage(latest.id));
        }
        existing += 1;
        continue;
      }

      const proxyVersion = (latest?.proxy_version ?? 0) + 1;
      const idempotencyKey = previewIdempotencyKey(
        projectId,
        candidate.id,
        segmentIndex,
        proxyVersion
      );
      const jobId = newId();
      const assetId = newId();
      const segmentId = `s${segmentIndex}`;
      const proxySourceStartMs = Math.max(
        0,
        segment.startMs - PREVIEW_PROXY_PRESET.handleDurationMs
      );
      const proxySourceEndMs = Math.min(
        project.source_duration_ms,
        segment.endMs + PREVIEW_PROXY_PRESET.handleDurationMs
      );
      const expiresAt = previewExpiresAt();
      const r2Key = VideoWorkspaceR2.previewProxyKey(
        userId,
        projectId,
        candidate.id,
        segmentId,
        proxyVersion
      );
      try {
        await db.batch([
          db.prepare(
            `INSERT INTO media_assets
               (id, user_id, project_id, kind, r2_key, mime_type, status, expires_at)
             VALUES (?1, ?2, ?3, 'preview_proxy', ?4, 'video/mp4', 'pending', ?5)`
          ).bind(assetId, userId, projectId, r2Key, expiresAt),
          db.prepare(
            `INSERT INTO render_jobs
               (id, user_id, project_id, project_version_id, candidate_id,
                segment_index, segment_id, source_start_ms, source_end_ms,
                proxy_source_start_ms, proxy_source_end_ms, proxy_version,
                kind, preset_id, scope_key, status, idempotency_key,
                output_asset_id, queued_at)
             VALUES
               (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
                'preview', ?12, ?13, 'queued', ?14, ?15, CURRENT_TIMESTAMP)`
          ).bind(
            jobId,
            userId,
            projectId,
            candidate.id,
            segmentIndex,
            segmentId,
            segment.startMs,
            segment.endMs,
            proxySourceStartMs,
            proxySourceEndMs,
            proxyVersion,
            PREVIEW_PROXY_PRESET.id,
            `candidate:${candidate.id}:segment:${segmentIndex}:v${proxyVersion}`,
            idempotencyKey,
            assetId
          ),
        ]);
      } catch (error) {
        const raced = await db.prepare(
          `SELECT id FROM render_jobs
            WHERE user_id = ?1 AND idempotency_key = ?2`
        )
          .bind(userId, idempotencyKey)
          .first<{ id: string }>();
        if (!raced) throw error;
        existing += 1;
        continue;
      }
      messages.push(dispatchMessage(jobId));
    }
  }

  if (messages.length > 0) await queue.sendBatch(messages);
  return { ok: true, created: messages.length, existing };
}

export async function listCandidatePreviews(
  db: D1Database,
  userId: string,
  projectId: string
): Promise<CandidatePreview[]> {
  const { results } = await db.prepare(
    `SELECT j.candidate_id, j.segment_index, j.id AS job_id, j.status AS job_status,
            j.output_asset_id AS asset_id, a.status AS asset_status,
            j.source_start_ms, j.source_end_ms, j.proxy_source_start_ms,
            j.proxy_source_end_ms, j.proxy_version, c.segments_json
       FROM render_jobs j
       JOIN media_assets a
         ON a.id = j.output_asset_id AND a.user_id = j.user_id
       JOIN clip_candidates c
         ON c.id = j.candidate_id AND c.user_id = j.user_id AND c.project_id = j.project_id
       JOIN video_projects p
         ON p.id = j.project_id AND p.user_id = j.user_id
      WHERE j.user_id = ?1
        AND j.project_id = ?2
        AND j.kind = 'preview'
        AND c.status <> 'deleted'
        AND p.deleted_at IS NULL
        AND a.deleted_at IS NULL
        AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)
      ORDER BY j.candidate_id, j.segment_index, j.proxy_version DESC`
  )
    .bind(userId, projectId)
    .all<{
      candidate_id: string;
      segment_index: number;
      job_id: string;
      job_status: string;
      asset_id: string;
      asset_status: string;
      source_start_ms: number;
      source_end_ms: number;
      proxy_source_start_ms: number;
      proxy_source_end_ms: number;
      proxy_version: number;
      segments_json: string;
    }>();

  const byCandidate = new Map<string, {
    segments: CandidatePreview["segments"];
    expectedSegments: number;
  }>();
  const seen = new Set<string>();
  for (const row of results) {
    const key = `${row.candidate_id}:${row.segment_index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const group = byCandidate.get(row.candidate_id) ?? {
      segments: [],
      expectedSegments: parseSegments(row.segments_json).length,
    };
    const segments = group.segments;
    segments.push({
      segmentIndex: row.segment_index,
      jobId: row.job_id,
      jobStatus: row.job_status,
      assetId: row.asset_id,
      assetStatus: row.asset_status,
      sourceStartMs: row.source_start_ms,
      sourceEndMs: row.source_end_ms,
      proxySourceStartMs: row.proxy_source_start_ms,
      proxySourceEndMs: row.proxy_source_end_ms,
      proxyVersion: row.proxy_version,
    });
    byCandidate.set(row.candidate_id, group);
  }
  return [...byCandidate].map(([candidateId, group]) => ({
    candidateId,
    status: previewStatus(group.segments, group.expectedSegments),
    segments: group.segments,
  }));
}

export async function candidatePreview(
  db: D1Database,
  userId: string,
  projectId: string,
  candidateId: string
): Promise<CandidatePreview | null> {
  const previews = await listCandidatePreviews(db, userId, projectId);
  return previews.find((preview) => preview.candidateId === candidateId) ?? null;
}

function previewStatus(
  segments: CandidatePreview["segments"],
  expectedSegments: number
): CandidatePreview["status"] {
  if (segments.length === 0) return "not_requested";
  if (
    segments.length === expectedSegments &&
    segments.every((segment) => segment.jobStatus === "completed")
  ) return "ready";
  if (segments.some((segment) => segment.jobStatus === "failed")) return "failed";
  if (segments.some((segment) => ["preparing", "running", "uploading"].includes(segment.jobStatus))) {
    return "processing";
  }
  return "queued";
}

function candidateRows(
  db: D1Database,
  userId: string,
  projectId: string,
  candidateIds: string[] | undefined
): Promise<PreviewCandidateRow[]> {
  const filters = candidateIds?.length
    ? `AND c.id IN (${candidateIds.map((_, index) => `?${index + 3}`).join(",")})`
    : "";
  return db.prepare(
    `SELECT c.id, c.rank, c.segments_json
       FROM clip_candidates c
       JOIN video_projects p
         ON p.id = c.project_id AND p.user_id = c.user_id
      WHERE c.user_id = ?1
        AND c.project_id = ?2
        AND c.status <> 'deleted'
        AND p.deleted_at IS NULL
        ${filters}
      ORDER BY c.rank ASC`
  )
    .bind(userId, projectId, ...(candidateIds ?? []))
    .all<PreviewCandidateRow>()
    .then(({ results }) => results);
}

function previewProject(
  db: D1Database,
  userId: string,
  projectId: string
): Promise<PreviewProjectRow | null> {
  return db.prepare(
    `SELECT p.id, p.user_id, p.source_asset_id, a.duration_ms AS source_duration_ms,
            a.status AS source_status, a.expires_at AS source_expires_at
       FROM video_projects p
       JOIN media_assets a
         ON a.id = p.source_asset_id AND a.user_id = p.user_id
      WHERE p.id = ?1
        AND p.user_id = ?2
        AND p.deleted_at IS NULL
        AND a.deleted_at IS NULL
        AND a.duration_ms IS NOT NULL`
  )
    .bind(projectId, userId)
    .first<PreviewProjectRow>();
}

function parseSegments(value: string): ClipCandidate["segments"] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((segment) => (
    segment &&
    typeof segment === "object" &&
    Number.isInteger((segment as { startMs?: unknown }).startMs) &&
    Number.isInteger((segment as { endMs?: unknown }).endMs) &&
    Number((segment as { startMs: number }).startMs) >= 0 &&
    Number((segment as { endMs: number }).endMs) > Number((segment as { startMs: number }).startMs)
  ))) {
    throw new Error("invalid_candidate_segments");
  }
  return parsed as ClipCandidate["segments"];
}

function previewIdempotencyKey(
  projectId: string,
  candidateId: string,
  segmentIndex: number,
  proxyVersion: number
): string {
  return `preview:${projectId}:${candidateId}:${segmentIndex}:v${proxyVersion}`;
}

async function resetFailedPreviewJob(
  db: D1Database,
  userId: string,
  jobId: string
): Promise<boolean> {
  const retried = await db.prepare(
    `UPDATE render_jobs
        SET status = 'queued', provider = NULL, provider_job_id = NULL,
            error_code = NULL, queued_at = CURRENT_TIMESTAMP,
            provider_submitted_at = NULL, started_at = NULL,
            upload_started_at = NULL, completed_at = NULL,
            billable_duration_ms = NULL, estimated_cost_microusd = NULL,
            cost_model = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1 AND user_id = ?2 AND status = 'failed'`
  )
    .bind(jobId, userId)
    .run();
  if (!retried.meta?.changes) return false;
  await db.prepare(
    `UPDATE media_assets
        SET status = 'pending', bytes = NULL, duration_ms = NULL,
            width = NULL, height = NULL, deleted_at = NULL,
            expires_at = ?1
      WHERE id = (
        SELECT output_asset_id FROM render_jobs WHERE id = ?2 AND user_id = ?3
      )
        AND r2_key IS NOT NULL`
  )
    .bind(previewExpiresAt(), jobId, userId)
    .run();
  return true;
}

function dispatchMessage(jobId: string): {
  body: RenderDispatchMessage;
  contentType: "json";
} {
  return {
    body: { schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION, jobId },
    contentType: "json",
  };
}

function previewExpiresAt(now = new Date()): string {
  return new Date(now.getTime() + PREVIEW_PROXY_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

function sourceExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const value = expiresAt.includes("T")
    ? expiresAt
    : `${expiresAt.replace(" ", "T")}Z`;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}
