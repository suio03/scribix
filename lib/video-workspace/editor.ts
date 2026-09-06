import type { AaiTranscript } from "@/lib/aai";
import { newId } from "@/lib/ids";
import { presignGet } from "@/lib/r2";
import { presignOwnedAssetGet } from "./asset-access";
import { listBrandAssets, type EditorBrandAsset } from "./brand-assets";
import {
  FINAL_VIDEO_PRESET,
  PREVIEW_PROXY_URL_TTL_SECONDS,
  VIDEO_WORKSPACE_LIMITS,
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
  theme: string;
  origin: "ai" | "manual";
  segments_json: string;
  status: string;
  draft_revision: number;
  draft_edl_json: string | null;
  draft_render_spec_json: string | null;
};

export type EditorWorkspace = {
  candidateId: string;
  clipTitle: string;
  revision: number;
  restoredDraft: boolean;
  sourceDurationMs: number;
  edl: Edl;
  renderSpec: RenderSpec;
  words: TranscriptWordBoundary[];
  previewStatus: "not_requested" | "queued" | "processing" | "ready" | "failed";
  proxies: ProxyTimelineSource[];
  assets: EditorBrandAsset[];
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

export type GeneratedDraftResult =
  | { ok: true; revision: number }
  | {
      ok: false;
      error:
        | "project_not_found"
        | "candidate_not_found"
        | "source_video_missing"
        | "transcript_not_ready"
        | "manual_candidate_forbidden"
        | "invalid_candidate"
        | "invalid_edl"
        | "invalid_render_spec"
        | "draft_conflict";
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
  const restored = parseStoredDraft(
    candidate.draft_edl_json,
    candidate.draft_render_spec_json,
    project.source_duration_ms
  );
  const activeDraft = Boolean(
    restored &&
    project.draft_candidate_id === candidateId &&
    project.draft_revision === candidate.draft_revision &&
    project.draft_edl_json === candidate.draft_edl_json &&
    project.draft_render_spec_json === candidate.draft_render_spec_json
  );
  const edl = restored?.edl ?? candidateEdl;
  let renderSpec = restored?.renderSpec ?? defaultRenderSpec(edl);
  const [preview, transcriptObject, assets] = await Promise.all([
    candidatePreview(db, userId, projectId, candidateId),
    bucket.get(project.transcript_r2_key),
    listBrandAssets(db, userId, projectId, presignGet),
  ]);
  if (!transcriptObject) return { ok: false, error: "transcript_not_ready" };
  const transcript = (await transcriptObject.json()) as AaiTranscript;
  const words = relevantWords(transcript, edl);
  if (!restored) renderSpec = defaultRenderSpec(edl, words);
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

  for (const segment of edl.segments) {
    const analysis = preview?.segments.find(item => `s${item.segmentIndex}` === segment.id)?.autoFraming;
    if (analysis && !activeDraft && !renderSpec.segments[segment.id].autoFraming) renderSpec.segments[segment.id] = { ...renderSpec.segments[segment.id], autoFraming: analysis };
  }
  return {
    ok: true,
    workspace: {
      candidateId,
      clipTitle: candidate.theme,
      revision: candidate.draft_revision,
      restoredDraft: activeDraft,
      sourceDurationMs: project.source_duration_ms,
      edl,
      renderSpec,
      words,
      previewStatus: preview?.status ?? "not_requested",
      proxies: proxies.filter((proxy): proxy is ProxyTimelineSource => proxy !== null),
      assets,
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
  const assetIssue = await renderAssetIssue(
    db,
    userId,
    projectId,
    renderSpecResult.data
  );
  if (assetIssue) {
    return { ok: false, error: "invalid_render_spec", issues: [assetIssue] };
  }
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return { ok: false, error: "draft_conflict", revision: candidate.draft_revision };
  }
  const edlJson = JSON.stringify(edlResult.data);
  const renderSpecJson = JSON.stringify(renderSpecResult.data);
  const nextRevision = expectedRevision + 1;
  const saved = await db.batch([
    db.prepare(
      `UPDATE clip_candidates
          SET draft_edl_json = ?1,
              draft_render_spec_json = ?2,
              draft_revision = draft_revision + 1
        WHERE id = ?3
          AND project_id = ?4
          AND user_id = ?5
          AND draft_revision = ?6
          AND status <> 'deleted'`
    ).bind(edlJson, renderSpecJson, candidateId, projectId, userId, expectedRevision),
    db.prepare(
      `UPDATE video_projects
          SET draft_candidate_id = ?1,
              draft_edl_json = (
                SELECT draft_edl_json FROM clip_candidates
                 WHERE id = ?1 AND project_id = ?2 AND user_id = ?3
              ),
              draft_render_spec_json = (
                SELECT draft_render_spec_json FROM clip_candidates
                 WHERE id = ?1 AND project_id = ?2 AND user_id = ?3
              ),
              draft_revision = (
                SELECT draft_revision FROM clip_candidates
                 WHERE id = ?1 AND project_id = ?2 AND user_id = ?3
              ),
              status = 'editing',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?2
          AND user_id = ?3
          AND deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM clip_candidates
             WHERE id = ?1 AND project_id = ?2 AND user_id = ?3
               AND draft_revision = ?4
          )`
    ).bind(candidateId, projectId, userId, nextRevision),
  ]);
  if (!saved[0].meta?.changes || !saved[1].meta?.changes) {
    const current = await editorCandidate(db, userId, projectId, candidateId);
    return { ok: false, error: "draft_conflict", revision: current?.draft_revision };
  }
  return { ok: true, revision: nextRevision };
}

export async function prepareGeneratedCandidateDraft(
  db: D1Database,
  bucket: R2Bucket,
  userId: string,
  projectId: string,
  candidateId: string
): Promise<GeneratedDraftResult> {
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
  if (candidate.origin !== "ai") {
    return { ok: false, error: "manual_candidate_forbidden" };
  }
  const segments = parseCandidateSegments(candidate.segments_json);
  if (!segments) return { ok: false, error: "invalid_candidate" };

  const transcriptObject = await bucket.get(project.transcript_r2_key);
  if (!transcriptObject) return { ok: false, error: "transcript_not_ready" };
  const transcript = (await transcriptObject.json()) as AaiTranscript;
  const edl = edlFromCandidate(segments);
  const renderSpec = defaultRenderSpec(edl, relevantWords(transcript, edl));
  const preview = await candidatePreview(db, userId, projectId, candidateId);
  for (const segment of edl.segments) {
    const analysis = preview?.segments.find(item => `s${item.segmentIndex}` === segment.id)?.autoFraming;
    if (analysis) renderSpec.segments[segment.id].autoFraming = analysis;
  }
  const saved = await saveProjectDraft(
    db,
    userId,
    projectId,
    candidateId,
    candidate.draft_revision,
    edl,
    renderSpec
  );
  return saved.ok
    ? { ok: true, revision: saved.revision }
    : { ok: false, error: saved.error, revision: saved.revision };
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
           (id, user_id, project_id, candidate_id, version, edl_json,
            render_spec_json, created_by)
         SELECT ?1, user_id, id, ?5, ?2, draft_edl_json, draft_render_spec_json, ?3
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

export function defaultRenderSpec(
  edl: Edl,
  words: TranscriptWordBoundary[] = []
): RenderSpec {
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
      { framingMode: "auto", crop: { x: 0.5, y: 0.5, zoom: 1 } },
    ])),
    captions: {
      enabled: true,
      templateId: "karaoke-v1",
      fontAssetId: null,
      textColor: "#FFFFFF",
      highlightColor: "#FFD600",
      positionY: 0.78,
      maxCharsPerLine: 22,
      maxLines: 2,
      cues: captionCues(edl, words),
    },
    brand: {
      templateId: null,
      logoAssetId: null,
      accentColor: "#FF5A1F",
      logoPosition: "top-right",
      logoScale: 0.16,
    },
    audio: { gainDb: 0, normalize: false, fadeInMs: 0, fadeOutMs: 0 },
    coverTimelineMs: Math.min(4_800, Math.max(0, edlTimelineDurationMs(edl) - 1)),
  };
}

function captionCues(edl: Edl, words: TranscriptWordBoundary[]): RenderSpec["captions"]["cues"] {
  const cues: RenderSpec["captions"]["cues"] = [];
  for (const segment of [...edl.segments].sort((left, right) => left.order - right.order)) {
    const segmentWords = words.filter((word) => (
      word.endMs > segment.sourceStartMs && word.startMs < segment.sourceEndMs
    ));
    for (let index = 0; index < segmentWords.length; index += 6) {
      const group = segmentWords.slice(index, index + 6);
      if (group.length === 0) continue;
      cues.push({
        id: `cue_${cues.length}`,
        segmentId: segment.id,
        sourceStartMs: Math.max(segment.sourceStartMs, group[0].startMs),
        sourceEndMs: Math.min(segment.sourceEndMs, group.at(-1)?.endMs ?? group[0].endMs),
        words: group.map((word) => ({
          text: word.text,
          sourceStartMs: Math.max(segment.sourceStartMs, word.startMs),
          sourceEndMs: Math.min(segment.sourceEndMs, word.endMs),
        })),
      });
    }
  }
  return cues;
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
    `SELECT id, theme, origin, segments_json, status, draft_revision,
            draft_edl_json, draft_render_spec_json
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

async function renderAssetIssue(
  db: D1Database,
  userId: string,
  projectId: string,
  renderSpec: RenderSpec
): Promise<ContractIssue | null> {
  const requested = [
    renderSpec.captions.fontAssetId
      ? { id: renderSpec.captions.fontAssetId, kind: "font", path: "$.captions.fontAssetId" }
      : null,
    renderSpec.brand.logoAssetId
      ? { id: renderSpec.brand.logoAssetId, kind: "logo", path: "$.brand.logoAssetId" }
      : null,
  ].filter((asset): asset is { id: string; kind: "font" | "logo"; path: string } => asset !== null);
  for (const asset of requested) {
    const owned = await db.prepare(
      `SELECT id FROM media_assets
        WHERE id = ?1
          AND user_id = ?2
          AND project_id = ?3
          AND kind = ?4
          AND status = 'ready'
          AND deleted_at IS NULL`
    )
      .bind(asset.id, userId, projectId, asset.kind)
      .first<{ id: string }>();
    if (!owned) {
      return {
        path: asset.path,
        code: "asset_not_owned",
        message: "Render assets must be ready and owned by this project.",
      };
    }
  }
  return null;
}

function sourceExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const value = expiresAt.includes("T") ? expiresAt : `${expiresAt.replace(" ", "T")}Z`;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}
