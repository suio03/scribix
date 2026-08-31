import type { AaiTranscript } from "@/lib/aai";
import { newId } from "@/lib/ids";
import { presignOwnedAssetGet } from "./asset-access";
import {
  FINAL_VIDEO_PRESET,
  PREVIEW_PROXY_URL_TTL_SECONDS,
  VIDEO_WORKSPACE_SCHEMA_VERSION,
  edlTimelineDurationMs,
  type CandidateSegment,
  type Edl,
  type RenderSpec,
} from "./contracts";
import { candidatePreview } from "./preview-jobs";
import type { ProxyTimelineSource, TranscriptWordBoundary } from "./timeline";
import { validateEdl, validateRenderSpec, type ContractIssue } from "./validation";

type EditorProjectRow = {
  id: string;
  transcript_r2_key: string | null;
  source_duration_ms: number | null;
  source_status: string | null;
  source_expires_at: string | null;
  draft_candidate_id: string | null;
  draft_revision: number;
  draft_edl_json: string | null;
  draft_render_spec_json: string | null;
};

type EditorCandidateRow = {
  id: string;
  segments_json: string;
  status: string;
};

export type EditorWorkspace = {
  candidateId: string;
  revision: number;
  restoredDraft: boolean;
  sourceDurationMs: number;
  edl: Edl;
  renderSpec: RenderSpec;
  words: TranscriptWordBoundary[];
  previewStatus: "not_requested" | "queued" | "processing" | "ready" | "failed";
  proxies: ProxyTimelineSource[];
};

export type EditorLoadResult =
  | { ok: true; workspace: EditorWorkspace }
  | {
      ok: false;
      error:
        | "project_not_found"
        | "candidate_not_found"
        | "source_video_missing"
        | "transcript_not_ready"
        | "invalid_candidate";
    };

export type SaveDraftResult =
  | { ok: true; revision: number }
  | {
      ok: false;
      error:
        | "project_not_found"
        | "candidate_not_found"
        | "source_video_missing"
        | "invalid_edl"
        | "invalid_render_spec"
        | "draft_conflict";
      issues?: ContractIssue[];
      revision?: number;
    };

export type SnapshotResult =
  | { ok: true; projectVersionId: string; version: number }
  | {
      ok: false;
      error:
        | "project_not_found"
        | "draft_missing"
        | "draft_conflict"
        | "invalid_edl"
        | "invalid_render_spec";
      revision?: number;
    };

export async function loadEditorWorkspace(
  db: D1Database,
  bucket: R2Bucket,
  userId: string,
  projectId: string,
  candidateId: string
): Promise<EditorLoadResult> {
  const project = await editorProject(db, userId, projectId);
  if (!project) return { ok: false, error: "project_not_found" };
  if (
    project.source_status !== "ready" ||
    !project.source_duration_ms ||
    sourceExpired(project.source_expires_at)
  ) {
    return { ok: false, error: "source_video_missing" };
  }
  if (!project.transcript_r2_key) {
    return { ok: false, error: "transcript_not_ready" };
  }
  const candidate = await editorCandidate(db, userId, projectId, candidateId);
  if (!candidate) return { ok: false, error: "candidate_not_found" };
  const candidateSegments = parseCandidateSegments(candidate.segments_json);
  if (!candidateSegments) return { ok: false, error: "invalid_candidate" };

  const candidateEdl = edlFromCandidate(candidateSegments);
  const restored = project.draft_candidate_id === candidateId
    ? parseStoredDraft(
        project.draft_edl_json,
        project.draft_render_spec_json,
        project.source_duration_ms
      )
    : null;
  const edl = restored?.edl ?? candidateEdl;
  const renderSpec = restored?.renderSpec ?? defaultRenderSpec(edl);
  const [preview, transcriptObject] = await Promise.all([
    candidatePreview(db, userId, projectId, candidateId),
    bucket.get(project.transcript_r2_key),
  ]);
  if (!transcriptObject) return { ok: false, error: "transcript_not_ready" };
  const transcript = (await transcriptObject.json()) as AaiTranscript;
  const words = relevantWords(transcript, edl);
  const proxies = preview
    ? await Promise.all(preview.segments.map(async (segment) => {
        if (segment.jobStatus !== "completed" || segment.assetStatus !== "ready") {
          return null;
        }
        const access = await presignOwnedAssetGet(
          db,
          userId,
          projectId,
          segment.assetId,
          PREVIEW_PROXY_URL_TTL_SECONDS
        );
        if (!access.ok) return null;
        return {
          segmentId: `s${segment.segmentIndex}`,
          segmentIndex: segment.segmentIndex,
          url: access.url,
          sourceStartMs: segment.sourceStartMs,
          sourceEndMs: segment.sourceEndMs,
          proxySourceStartMs: segment.proxySourceStartMs,
          proxySourceEndMs: segment.proxySourceEndMs,
        } satisfies ProxyTimelineSource;
      }))
    : [];

  return {
    ok: true,
    workspace: {
      candidateId,
      revision: project.draft_revision,
      restoredDraft: Boolean(restored),
      sourceDurationMs: project.source_duration_ms,
      edl,
      renderSpec,
      words,
      previewStatus: preview?.status ?? "not_requested",
      proxies: proxies.filter((proxy): proxy is ProxyTimelineSource => proxy !== null),
    },
  };
}

export async function saveProjectDraft(
  db: D1Database,
  userId: string,
  projectId: string,
  candidateId: string,
  expectedRevision: number,
  edlInput: unknown,
  renderSpecInput: unknown
): Promise<SaveDraftResult> {
  const project = await editorProject(db, userId, projectId);
  if (!project) return { ok: false, error: "project_not_found" };
  if (
    project.source_status !== "ready" ||
    !project.source_duration_ms ||
    sourceExpired(project.source_expires_at)
  ) {
    return { ok: false, error: "source_video_missing" };
  }
  const candidate = await editorCandidate(db, userId, projectId, candidateId);
  if (!candidate) return { ok: false, error: "candidate_not_found" };
  const candidateSegments = parseCandidateSegments(candidate.segments_json);
  if (!candidateSegments) return { ok: false, error: "candidate_not_found" };

  const edlResult = validateEdl(edlInput, { sourceDurationMs: project.source_duration_ms });
  if (!edlResult.success) {
    return { ok: false, error: "invalid_edl", issues: edlResult.issues };
  }
  const allowedSegmentIds = new Set(candidateSegments.map((_, index) => `s${index}`));
  if (edlResult.data.segments.some((segment) => !allowedSegmentIds.has(segment.id))) {
    return {
      ok: false,
      error: "invalid_edl",
      issues: [{
        path: "$.segments",
        code: "unknown_candidate_segment",
        message: "Draft segments must originate from the selected candidate.",
      }],
    };
  }
  const renderSpecResult = validateRenderSpec(renderSpecInput, edlResult.data);
  if (!renderSpecResult.success) {
    return { ok: false, error: "invalid_render_spec", issues: renderSpecResult.issues };
  }
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return { ok: false, error: "draft_conflict", revision: project.draft_revision };
  }
  const saved = await db.prepare(
    `UPDATE video_projects
        SET draft_candidate_id = ?1,
            draft_edl_json = ?2,
            draft_render_spec_json = ?3,
            draft_revision = draft_revision + 1,
            status = 'editing',
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?4
        AND user_id = ?5
        AND draft_revision = ?6
        AND deleted_at IS NULL`
  )
    .bind(
      candidateId,
      JSON.stringify(edlResult.data),
      JSON.stringify(renderSpecResult.data),
      projectId,
      userId,
      expectedRevision
    )
    .run();
  if (!saved.meta?.changes) {
    const current = await editorProject(db, userId, projectId);
    return { ok: false, error: "draft_conflict", revision: current?.draft_revision };
  }
  return { ok: true, revision: expectedRevision + 1 };
}

export async function snapshotProjectDraft(
  db: D1Database,
  userId: string,
  projectId: string,
  candidateId: string,
  expectedRevision: number
): Promise<SnapshotResult> {
  const project = await editorProject(db, userId, projectId);
  if (!project) return { ok: false, error: "project_not_found" };
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
  const parsed = parseStoredDraft(
    project.draft_edl_json,
    project.draft_render_spec_json,
    project.source_duration_ms ?? undefined
  );
  if (!parsed) return { ok: false, error: "invalid_edl" };
  const projectVersionId = newId();
  const version = await nextProjectVersion(db, userId, projectId);
  try {
    const results = await db.batch([
      db.prepare(
        `INSERT INTO project_versions
           (id, user_id, project_id, version, edl_json, render_spec_json, created_by)
         SELECT ?1, user_id, id, ?2, draft_edl_json, draft_render_spec_json, ?3
           FROM video_projects
          WHERE id = ?4
            AND user_id = ?3
            AND draft_candidate_id = ?5
            AND draft_revision = ?6
            AND deleted_at IS NULL`
      ).bind(
        projectVersionId,
        version,
        userId,
        projectId,
        candidateId,
        expectedRevision
      ),
      db.prepare(
        `UPDATE video_projects
            SET active_project_version_id = ?1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?2
            AND user_id = ?3
            AND draft_revision = ?4
            AND EXISTS (
              SELECT 1 FROM project_versions
               WHERE id = ?1 AND user_id = ?3 AND project_id = ?2
            )`
      ).bind(projectVersionId, projectId, userId, expectedRevision),
    ]);
    if (!results[0].meta?.changes || !results[1].meta?.changes) {
      return { ok: false, error: "draft_conflict", revision: project.draft_revision };
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return { ok: false, error: "draft_conflict", revision: project.draft_revision };
    }
    throw error;
  }
  return { ok: true, projectVersionId, version };
}

export function edlFromCandidate(segments: CandidateSegment[]): Edl {
  return {
    schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION,
    segments: segments.map((segment, index) => ({
      id: `s${index}`,
      sourceStartMs: segment.startMs,
      sourceEndMs: segment.endMs,
      order: index,
    })),
  };
}

export function defaultRenderSpec(edl: Edl): RenderSpec {
  return {
    schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION,
    outputPresetId: FINAL_VIDEO_PRESET.id,
    canvas: {
      width: FINAL_VIDEO_PRESET.width,
      height: FINAL_VIDEO_PRESET.height,
      fps: FINAL_VIDEO_PRESET.fps,
      backgroundColor: "#000000",
    },
    segments: Object.fromEntries(edl.segments.map((segment) => [
      segment.id,
      { crop: { x: 0.5, y: 0.5, zoom: 1 } },
    ])),
    captions: {
      templateId: "karaoke-v1",
      fontAssetId: null,
      textColor: "#FFFFFF",
      highlightColor: "#FFD600",
      positionY: 0.78,
    },
    brand: { templateId: null, logoAssetId: null },
    audio: { gainDb: 0, normalize: true, fadeInMs: 0, fadeOutMs: 250 },
    coverTimelineMs: Math.min(4_800, Math.max(0, edlTimelineDurationMs(edl) - 1)),
  };
}

function editorProject(
  db: D1Database,
  userId: string,
  projectId: string
): Promise<EditorProjectRow | null> {
  return db.prepare(
    `SELECT p.id, t.transcript_r2_key, a.duration_ms AS source_duration_ms,
            a.status AS source_status, a.expires_at AS source_expires_at,
            p.draft_candidate_id, p.draft_revision, p.draft_edl_json,
            p.draft_render_spec_json
       FROM video_projects p
       JOIN transcripts t
         ON t.id = p.transcript_id AND t.user_id = p.user_id
       LEFT JOIN media_assets a
         ON a.id = p.source_asset_id AND a.user_id = p.user_id
      WHERE p.id = ?1
        AND p.user_id = ?2
        AND p.deleted_at IS NULL
        AND t.deleted_at IS NULL`
  )
    .bind(projectId, userId)
    .first<EditorProjectRow>();
}

function editorCandidate(
  db: D1Database,
  userId: string,
  projectId: string,
  candidateId: string
): Promise<EditorCandidateRow | null> {
  return db.prepare(
    `SELECT id, segments_json, status
       FROM clip_candidates
      WHERE id = ?1
        AND user_id = ?2
        AND project_id = ?3
        AND status <> 'deleted'`
  )
    .bind(candidateId, userId, projectId)
    .first<EditorCandidateRow>();
}

function parseCandidateSegments(value: string): CandidateSegment[] | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((segment) => (
      segment &&
      typeof segment === "object" &&
      Number.isInteger((segment as CandidateSegment).startMs) &&
      Number.isInteger((segment as CandidateSegment).endMs)
    ))
      ? parsed as CandidateSegment[]
      : null;
  } catch {
    return null;
  }
}

function parseStoredDraft(
  edlJson: string | null,
  renderSpecJson: string | null,
  sourceDurationMs: number | undefined
): { edl: Edl; renderSpec: RenderSpec } | null {
  if (!edlJson || !renderSpecJson) return null;
  try {
    const edlResult = validateEdl(JSON.parse(edlJson), { sourceDurationMs });
    if (!edlResult.success) return null;
    const renderSpecResult = validateRenderSpec(JSON.parse(renderSpecJson), edlResult.data);
    return renderSpecResult.success
      ? { edl: edlResult.data, renderSpec: renderSpecResult.data }
      : null;
  } catch {
    return null;
  }
}

function relevantWords(transcript: AaiTranscript, edl: Edl): TranscriptWordBoundary[] {
  const ranges = edl.segments.map((segment) => ({
    startMs: Math.max(0, segment.sourceStartMs - 5_000),
    endMs: segment.sourceEndMs + 5_000,
  }));
  return (transcript.words ?? [])
    .flatMap((word) => {
      const startMs = Math.round(word.start);
      const endMs = Math.round(word.end);
      if (
        !word.text ||
        !Number.isInteger(startMs) ||
        !Number.isInteger(endMs) ||
        endMs <= startMs ||
        !ranges.some((range) => endMs >= range.startMs && startMs <= range.endMs)
      ) {
        return [];
      }
      return [{
        text: word.text.slice(0, 200),
        startMs,
        endMs,
        speaker: word.speaker?.slice(0, 64) ?? null,
      }];
    })
    .slice(0, 5_000);
}

async function nextProjectVersion(
  db: D1Database,
  userId: string,
  projectId: string
): Promise<number> {
  const row = await db.prepare(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM project_versions
      WHERE project_id = ?1 AND user_id = ?2`
  )
    .bind(projectId, userId)
    .first<{ next_version: number }>();
  return row?.next_version ?? 1;
}

function sourceExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const value = expiresAt.includes("T") ? expiresAt : `${expiresAt.replace(" ", "T")}Z`;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}
