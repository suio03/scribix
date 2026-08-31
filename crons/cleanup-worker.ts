// Scheduled cleanup worker for Scribix.
//
// Runs hourly and:
//   1. Hard-deletes `pending` / `uploading` rows older than 24h after
//      confirmed R2 cleanup.
//   2. Hard-deletes in-flight non-completed rows older than 24h after
//      confirmed R2 cleanup.
//   3. Hard-deletes `error` / `failed` rows older than 7d after
//      confirmed R2 cleanup.
//   4. Purges legacy soft-deleted rows after confirmed R2
//      cleanup.
//   5. For `completed` rows older than 14d, deletes the R2 audio object
//      and NULLs `audio_r2_key`. Transcript JSON is preserved forever.
//   6. Deletes expired video-project sources when no render job is active,
//      while preserving project versions and completed output assets.
//
// Deployed separately from the Next app via `wrangler.cleanup.jsonc`. Shares
// the same D1 + R2 bindings.

import {
  deleteVideoWorkspaceObjects,
  hardDeleteVideoProjects,
  videoWorkspaceDeletionForTranscript,
} from "../lib/video-workspace/lifecycle";

interface Env {
  DB: D1Database;
  SCRIBIX_MEDIA: R2Bucket;
}

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;      // 24h
const IN_FLIGHT_TTL_MS = 24 * 60 * 60 * 1000;    // 24h
const FAILED_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 7d
const AUDIO_TTL_MS = 14 * 24 * 60 * 60 * 1000;   // 14d

const PRE_SUBMIT_STATUSES = ["pending", "uploading"];
const IN_FLIGHT_STATUSES = [
  "queued",
  "processing",
  "extracting_audio",
  "uploading_audio",
  "transcribing",
];
const FAILED_STATUSES = ["error", "failed"];

type CleanupRow = {
  id: string;
  user_id: string;
  status: string;
  reserved_minutes: number | null;
  audio_r2_key: string | null;
  transcript_r2_key: string | null;
};

type SweepStats = { scanned: number; deleted: number; failed: number; retry: number };

type ExpiredVideoSourceRow = {
  asset_id: string;
  user_id: string;
  project_id: string;
  transcript_id: string;
  r2_key: string;
};

async function deleteR2(
  bucket: R2Bucket,
  row: CleanupRow,
  key: string | null
): Promise<boolean> {
  if (!key) return true;
  try {
    await bucket.delete(key);
    return true;
  } catch (e) {
    console.error(JSON.stringify({
      event: "cleanup_r2_delete_failed",
      transcriptId: row.id,
      r2Key: key,
      status: row.status,
      errorCategory: cleanupErrorCategory(e),
      error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }));
    return false;
  }
}

async function deleteVideoWorkspace(env: Env, row: CleanupRow): Promise<boolean> {
  try {
    const deletion = await videoWorkspaceDeletionForTranscript(env.DB, row.user_id, row.id);
    await deleteVideoWorkspaceObjects(env.SCRIBIX_MEDIA, deletion.r2Keys);
    await hardDeleteVideoProjects(env.DB, row.user_id, deletion.projectIds);
    return true;
  } catch (error) {
    console.error(JSON.stringify({
      event: "cleanup_video_workspace_delete_failed",
      transcriptId: row.id,
      errorCategory: cleanupErrorCategory(error),
      error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    }));
    return false;
  }
}

async function sweepExpiredRows(
  env: Env,
  statuses: string[],
  cutoffIso: string,
  refundReservation: boolean
): Promise<SweepStats> {
  const statusPlaceholders = statuses.map((_, i) => `?${i + 1}`).join(",");
  const cutoffParam = `?${statuses.length + 1}`;
  const rows = await env.DB.prepare(
    `SELECT id, user_id, status, reserved_minutes, audio_r2_key, transcript_r2_key
       FROM transcripts
      WHERE status IN (${statusPlaceholders})
        AND deleted_at IS NULL
        AND created_at < ${cutoffParam}`
  ).bind(...statuses, cutoffIso).all<CleanupRow>();

  const stats: SweepStats = { scanned: rows.results?.length ?? 0, deleted: 0, failed: 0, retry: 0 };
  for (const r of rows.results ?? []) {
    const audioDeleted = await deleteR2(env.SCRIBIX_MEDIA, r, r.audio_r2_key);
    const transcriptDeleted = await deleteR2(env.SCRIBIX_MEDIA, r, r.transcript_r2_key);
    if (!audioDeleted || !transcriptDeleted) {
      stats.failed += 1;
      stats.retry += 1;
      continue;
    }
    if (!(await deleteVideoWorkspace(env, r))) {
      stats.failed += 1;
      stats.retry += 1;
      continue;
    }
    const deleteStatusPlaceholders = statuses.map((_, i) => `?${i + 2}`).join(",");
    const refundStatusPlaceholders = statuses.map((_, i) => `?${i + 4}`).join(",");
    const deleteStatement = env.DB.prepare(
      `DELETE FROM transcripts
        WHERE id = ?1
          AND status IN (${deleteStatusPlaceholders})
          AND created_at < ?${statuses.length + 2}`
    ).bind(r.id, ...statuses, cutoffIso);
    if (refundReservation && r.reserved_minutes && r.reserved_minutes > 0) {
      const results = await env.DB.batch([
        env.DB.prepare(
          `UPDATE users
              SET minutes_used_this_period = MAX(0, minutes_used_this_period - ?1)
            WHERE id = ?2
              AND EXISTS (
                SELECT 1 FROM transcripts
                 WHERE id = ?3
                   AND status IN (${refundStatusPlaceholders})
                   AND created_at < ?${statuses.length + 4}
              )`
        ).bind(r.reserved_minutes, r.user_id, r.id, ...statuses, cutoffIso),
        deleteStatement,
      ]);
      if (results[1].meta?.changes) stats.deleted += 1;
    } else {
      const deleted = await deleteStatement.run();
      if (deleted.meta?.changes) stats.deleted += 1;
    }
  }
  return stats;
}

async function sweepLegacySoftDeleted(env: Env): Promise<SweepStats> {
  const rows = await env.DB.prepare(
    `SELECT id, user_id, status, reserved_minutes, audio_r2_key, transcript_r2_key
      FROM transcripts
      WHERE deleted_at IS NOT NULL`
  ).all<CleanupRow>();

  const stats: SweepStats = { scanned: rows.results?.length ?? 0, deleted: 0, failed: 0, retry: 0 };
  for (const r of rows.results ?? []) {
    const audioDeleted = await deleteR2(env.SCRIBIX_MEDIA, r, r.audio_r2_key);
    const transcriptDeleted = await deleteR2(env.SCRIBIX_MEDIA, r, r.transcript_r2_key);
    if (!audioDeleted || !transcriptDeleted) {
      stats.failed += 1;
      stats.retry += 1;
      continue;
    }
    if (!(await deleteVideoWorkspace(env, r))) {
      stats.failed += 1;
      stats.retry += 1;
      continue;
    }
    await env.DB.prepare(`DELETE FROM transcripts WHERE id = ?1`).bind(r.id).run();
    stats.deleted += 1;
  }
  return stats;
}

async function sweepExpiredAudio(env: Env, cutoffIso: string): Promise<SweepStats> {
  const rows = await env.DB.prepare(
    `SELECT id, user_id, status, reserved_minutes, audio_r2_key, transcript_r2_key
       FROM transcripts
      WHERE status = 'completed'
        AND deleted_at IS NULL
        AND audio_r2_key IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
            FROM media_assets a
            JOIN video_projects p
              ON p.id = a.project_id AND p.user_id = a.user_id
           WHERE a.user_id = transcripts.user_id
             AND a.r2_key = transcripts.audio_r2_key
             AND a.kind = 'source'
             AND a.deleted_at IS NULL
             AND p.deleted_at IS NULL
        )
        AND created_at < ?1`
  ).bind(cutoffIso).all<CleanupRow>();

  const stats: SweepStats = { scanned: rows.results?.length ?? 0, deleted: 0, failed: 0, retry: 0 };
  for (const r of rows.results ?? []) {
    if (!(await deleteR2(env.SCRIBIX_MEDIA, r, r.audio_r2_key))) {
      stats.failed += 1;
      stats.retry += 1;
      continue;
    }
    await env.DB.prepare(`UPDATE transcripts SET audio_r2_key = NULL WHERE id = ?1`)
      .bind(r.id)
      .run();
    stats.deleted += 1;
  }
  return stats;
}

async function sweepExpiredVideoSources(env: Env, nowIso: string): Promise<SweepStats> {
  const rows = await env.DB.prepare(
    `SELECT a.id AS asset_id, a.user_id, a.project_id, p.transcript_id, a.r2_key
       FROM media_assets a
       JOIN video_projects p
         ON p.id = a.project_id AND p.user_id = a.user_id
      WHERE a.kind = 'source'
        AND a.status = 'ready'
        AND a.deleted_at IS NULL
        AND a.r2_key IS NOT NULL
        AND a.expires_at IS NOT NULL
        AND a.expires_at <= ?1
        AND p.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM render_jobs j
           WHERE j.project_id = p.id
             AND j.user_id = p.user_id
             AND j.status IN ('queued', 'preparing', 'running', 'uploading')
        )`
  )
    .bind(nowIso)
    .all<ExpiredVideoSourceRow>();

  const stats: SweepStats = { scanned: rows.results.length, deleted: 0, failed: 0, retry: 0 };
  for (const source of rows.results) {
    try {
      await env.SCRIBIX_MEDIA.delete(source.r2_key);
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE video_projects
              SET source_asset_id = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?1 AND user_id = ?2 AND source_asset_id = ?3`
        ).bind(source.project_id, source.user_id, source.asset_id),
        env.DB.prepare(
          `UPDATE transcripts
              SET audio_r2_key = NULL
            WHERE id = ?1 AND user_id = ?2 AND audio_r2_key = ?3`
        ).bind(source.transcript_id, source.user_id, source.r2_key),
        env.DB.prepare(
          `UPDATE media_assets
              SET status = 'deleted', r2_key = NULL, deleted_at = CURRENT_TIMESTAMP
            WHERE id = ?1 AND user_id = ?2 AND status = 'ready'`
        ).bind(source.asset_id, source.user_id),
      ]);
      stats.deleted += 1;
    } catch (error) {
      stats.failed += 1;
      stats.retry += 1;
      console.error(JSON.stringify({
        event: "cleanup_expired_video_source_failed",
        projectId: source.project_id,
        assetId: source.asset_id,
        errorCategory: cleanupErrorCategory(error),
        error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      }));
    }
  }
  return stats;
}

function cleanupErrorCategory(error: unknown): string {
  if (error instanceof Error && /auth|forbidden|unauthorized/i.test(error.message)) return "auth";
  if (error instanceof Error && /timeout|network|fetch/i.test(error.message)) return "network";
  return "r2_delete";
}

function isoCutoff(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString().replace("T", " ").slice(0, 19);
}

async function runCleanup(env: Env): Promise<void> {
  const preSubmit = await sweepExpiredRows(env, PRE_SUBMIT_STATUSES, isoCutoff(PENDING_TTL_MS), true);
  const inFlight = await sweepExpiredRows(env, IN_FLIGHT_STATUSES, isoCutoff(IN_FLIGHT_TTL_MS), true);
  const failed = await sweepExpiredRows(env, FAILED_STATUSES, isoCutoff(FAILED_TTL_MS), false);
  const legacyDeleted = await sweepLegacySoftDeleted(env);
  const expiredVideoSources = await sweepExpiredVideoSources(
    env,
    new Date().toISOString().replace("T", " ").slice(0, 19)
  );
  const expired = await sweepExpiredAudio(env, isoCutoff(AUDIO_TTL_MS));
  const sweeps = {
    preSubmit,
    inFlight,
    failed,
    legacyDeleted,
    expiredVideoSources,
    expiredMedia: expired,
  };
  const totals = Object.values(sweeps).reduce(
    (total, stats) => ({
      scanned: total.scanned + stats.scanned,
      deleted: total.deleted + stats.deleted,
      failed: total.failed + stats.failed,
      retry: total.retry + stats.retry,
    }),
    { scanned: 0, deleted: 0, failed: 0, retry: 0 }
  );
  console.log(JSON.stringify({ event: "cleanup_completed", ...totals, sweeps }));
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCleanup(env));
  },
  // Manual trigger for testing: `curl https://<worker>.dev/?key=<CLEANUP_KEY>`
  async fetch(request: Request, env: Env & { CLEANUP_KEY?: string }): Promise<Response> {
    const url = new URL(request.url);
    if (!env.CLEANUP_KEY || url.searchParams.get("key") !== env.CLEANUP_KEY) {
      return new Response("forbidden", { status: 403 });
    }
    await runCleanup(env);
    return new Response("ok\n");
  },
};
