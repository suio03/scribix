import { newId } from "@/lib/ids";
import type { CandidateSet, ClipCandidate } from "./contracts";

export type ClipCandidateOrigin = "ai" | "manual";

export type StoredClipCandidate = ClipCandidate & {
  reviewMark?: "keep" | "discard" | null;
  rank: number;
  origin: ClipCandidateOrigin;
  status: "suggested" | "accepted" | "rejected";
  createdAt: string;
};

type CandidateRow = {
  review_mark: "keep" | "discard" | null;
  id: string;
  rank: number;
  theme: string;
  hook: string;
  reason: string;
  score: number;
  origin: ClipCandidateOrigin;
  segments_json: string;
  status: "suggested" | "accepted" | "rejected";
  created_at: string;
};

export async function listClipCandidates(
  db: D1Database,
  userId: string,
  projectId: string
): Promise<StoredClipCandidate[]> {
  const { results } = await db.prepare(
    `SELECT c.id, c.review_mark, c.rank, c.theme, c.hook, c.reason, c.score, c.origin,
            c.segments_json, c.status, c.created_at
       FROM clip_candidates c
       JOIN video_projects p
         ON p.id = c.project_id AND p.user_id = c.user_id
      WHERE c.project_id = ?1
        AND c.user_id = ?2
        AND c.status <> 'deleted'
        AND p.deleted_at IS NULL
      ORDER BY c.rank ASC`
  )
    .bind(projectId, userId)
    .all<CandidateRow>();

  return results.flatMap((row) => {
    const segments = parseSegments(row.segments_json);
    return segments
      ? [{
          schemaVersion: 1 as const,
          id: row.id,
          reviewMark: row.review_mark ?? null,
          rank: row.rank,
          origin: row.origin,
          theme: row.theme,
          hook: row.hook,
          reason: row.reason,
          score: row.score,
          segments,
          status: row.status,
          createdAt: row.created_at,
        }]
      : [];
  });
}

export async function replaceClipCandidates(
  db: D1Database,
  userId: string,
  projectId: string,
  candidateSet: CandidateSet,
  executionId?: string,
  fence?: {taskId:string;token:string}
): Promise<boolean> {
  const guard = (index: number) => fence ? ` AND EXISTS (SELECT 1 FROM ai_analysis_tasks WHERE id = ?${index} AND lease_token = ?${index+1} AND lease_until > unixepoch())` : "";
  const fenceBindings = fence ? [fence.taskId, fence.token] : [];
  const statements = [
    db.prepare(
      `DELETE FROM clip_candidates WHERE origin = 'ai' AND project_id = ?1 AND user_id = ?2 AND (?3 IS NULL OR EXISTS (SELECT 1 FROM video_projects WHERE id = ?1 AND selection_request_id = ?3 AND selection_outcome = 'running'))${guard(4)}`
    ).bind(projectId, userId, executionId ?? null, ...fenceBindings),
    ...candidateSet.candidates.map((candidate, rank) =>
      db.prepare(
        `INSERT INTO clip_candidates
           (id, user_id, project_id, rank, theme, hook, reason, score, segments_json)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9 WHERE ?10 IS NULL OR EXISTS (SELECT 1 FROM video_projects WHERE id = ?3 AND user_id = ?2 AND selection_request_id = ?10 AND selection_outcome = 'running')${guard(11)}`
      ).bind(
        candidate.id,
        userId,
        projectId,
        rank,
        candidate.theme,
        candidate.hook,
        candidate.reason,
        candidate.score,
        JSON.stringify(candidate.segments),
        executionId ?? null,
        ...fenceBindings
      )
    ),
    db.prepare(
      `UPDATE video_projects
          SET status = 'candidates_ready', selection_outcome = ?4, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL AND (?3 IS NULL OR (selection_request_id = ?3 AND selection_outcome = 'running'))${guard(5)}`
    ).bind(projectId, userId, executionId ?? null, candidateSet.candidates.length ? 'matched' : 'empty', ...fenceBindings),
  ];
  const results = await db.batch(statements);
  return Boolean(results[results.length - 1].meta.changes);
}

export async function createManualClipCandidate(
  db: D1Database,
  userId: string,
  projectId: string,
  sourceDurationMs: number,
  initialDurationMs: number
): Promise<string> {
  const candidateId = newId();
  const endMs = Math.min(sourceDurationMs, initialDurationMs);
  await db.prepare(
    `INSERT INTO clip_candidates
       (id, user_id, project_id, rank, theme, hook, reason, score,
        segments_json, status, origin)
     SELECT ?1, ?2, ?3, COALESCE(MAX(rank), -1) + 1,
            'manual_source', 'manual_source', 'manual_source', 0,
            ?4, 'accepted', 'manual'
       FROM clip_candidates
      WHERE project_id = ?3 AND user_id = ?2
     HAVING NOT EXISTS (
       SELECT 1 FROM clip_candidates
        WHERE project_id = ?3
          AND user_id = ?2
          AND origin = 'manual'
          AND status <> 'deleted'
     )`
  )
    .bind(
      candidateId,
      userId,
      projectId,
      JSON.stringify([{ startMs: 0, endMs }])
    )
    .run();
  await db.prepare(
    `UPDATE video_projects
        SET status = 'editing', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
  )
    .bind(projectId, userId)
    .run();
  const candidate = await db.prepare(
    `SELECT id
       FROM clip_candidates
      WHERE project_id = ?1
        AND user_id = ?2
        AND origin = 'manual'
        AND status <> 'deleted'
      LIMIT 1`
  )
    .bind(projectId, userId)
    .first<{ id: string }>();
  if (!candidate) throw new Error("manual_candidate_create_failed");
  return candidate.id;
}

function parseSegments(value: string): ClipCandidate["segments"] | null {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((segment) => (
      segment &&
      typeof segment === "object" &&
      Number.isInteger(segment.startMs) &&
      Number.isInteger(segment.endMs)
    ))) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
