import { newId } from "@/lib/ids";
import type { CandidateSet, ClipCandidate } from "./contracts";

export type ClipCandidateOrigin = "ai" | "manual";

export type StoredClipCandidate = ClipCandidate & {
  rank: number;
  origin: ClipCandidateOrigin;
  status: "suggested" | "accepted" | "rejected";
  createdAt: string;
};

type CandidateRow = {
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
    `SELECT c.id, c.rank, c.theme, c.hook, c.reason, c.score, c.origin,
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
  candidateSet: CandidateSet
): Promise<void> {
  const statements = [
    db.prepare(
      `DELETE FROM clip_candidates WHERE project_id = ?1 AND user_id = ?2`
    ).bind(projectId, userId),
    ...candidateSet.candidates.map((candidate, rank) =>
      db.prepare(
        `INSERT INTO clip_candidates
           (id, user_id, project_id, rank, theme, hook, reason, score, segments_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
      ).bind(
        candidate.id,
        userId,
        projectId,
        rank,
        candidate.theme,
        candidate.hook,
        candidate.reason,
        candidate.score,
        JSON.stringify(candidate.segments)
      )
    ),
    db.prepare(
      `UPDATE video_projects
          SET status = 'candidates_ready', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
    ).bind(projectId, userId),
  ];
  await db.batch(statements);
}

export async function replaceWithManualClipCandidate(
  db: D1Database,
  userId: string,
  projectId: string,
  sourceDurationMs: number,
  initialDurationMs: number
): Promise<string> {
  const candidateId = newId();
  const endMs = Math.min(sourceDurationMs, initialDurationMs);
  const statements = [
    db.prepare(
      `DELETE FROM clip_candidates WHERE project_id = ?1 AND user_id = ?2`
    ).bind(projectId, userId),
    db.prepare(
      `INSERT INTO clip_candidates
         (id, user_id, project_id, rank, theme, hook, reason, score,
          segments_json, status, origin)
       VALUES (?1, ?2, ?3, 0, 'manual_source', 'manual_source',
               'manual_source', 0, ?4, 'accepted', 'manual')`
    ).bind(
      candidateId,
      userId,
      projectId,
      JSON.stringify([{ startMs: 0, endMs }])
    ),
    db.prepare(
      `UPDATE video_projects
          SET status = 'editing', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
    ).bind(projectId, userId),
  ];
  await db.batch(statements);
  return candidateId;
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
