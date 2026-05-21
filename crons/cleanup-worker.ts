// Scheduled cleanup worker for Scribix.
//
// Runs hourly and:
//   1. Hard-deletes `pending` / `uploading` rows that have been stuck for >1h
//      (these never reached AssemblyAI; nothing to clean up in R2).
//   2. Soft-deletes `error` / `failed` rows older than 7 days and best-effort
//      removes any R2 audio source they uploaded before failing.
//   3. For `completed` rows older than 14 days, deletes the R2 audio object
//      and NULLs `audio_r2_key`. Transcript JSON is preserved forever.
//
// Deployed separately from the Next app via `wrangler.cleanup.jsonc`. Shares
// the same D1 + R2 bindings.

interface Env {
  DB: D1Database;
  SCRIBIX_MEDIA: R2Bucket;
}

const PENDING_TTL_MS = 60 * 60 * 1000;           // 1h
const FAILED_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 7d
const AUDIO_TTL_MS = 14 * 24 * 60 * 60 * 1000;   // 14d

type CleanupRow = {
  id: string;
  status: string;
  audio_r2_key: string | null;
  transcript_r2_key: string | null;
};

async function deleteR2Best(bucket: R2Bucket, key: string | null): Promise<void> {
  if (!key) return;
  try {
    await bucket.delete(key);
  } catch (e) {
    console.error(`r2 delete failed key=${key}`, e);
  }
}

async function sweepStuck(env: Env, cutoffIso: string): Promise<number> {
  const res = await env.DB.prepare(
    `DELETE FROM transcripts
      WHERE status IN ('pending', 'uploading')
        AND deleted_at IS NULL
        AND created_at < ?1`
  ).bind(cutoffIso).run();
  return res.meta?.changes ?? 0;
}

async function sweepFailed(env: Env, cutoffIso: string): Promise<number> {
  const rows = await env.DB.prepare(
    `SELECT id, status, audio_r2_key, transcript_r2_key
       FROM transcripts
      WHERE status IN ('error', 'failed')
        AND deleted_at IS NULL
        AND created_at < ?1`
  ).bind(cutoffIso).all<CleanupRow>();

  const ids: string[] = [];
  for (const r of rows.results ?? []) {
    await deleteR2Best(env.SCRIBIX_MEDIA, r.audio_r2_key);
    await deleteR2Best(env.SCRIBIX_MEDIA, r.transcript_r2_key);
    ids.push(r.id);
  }
  if (!ids.length) return 0;

  const placeholders = ids.map((_, i) => `?${i + 1}`).join(",");
  await env.DB.prepare(
    `UPDATE transcripts SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`
  ).bind(...ids).run();
  return ids.length;
}

async function sweepExpiredAudio(env: Env, cutoffIso: string): Promise<number> {
  const rows = await env.DB.prepare(
    `SELECT id, status, audio_r2_key, transcript_r2_key
       FROM transcripts
      WHERE status = 'completed'
        AND deleted_at IS NULL
        AND audio_r2_key IS NOT NULL
        AND created_at < ?1`
  ).bind(cutoffIso).all<CleanupRow>();

  const ids: string[] = [];
  for (const r of rows.results ?? []) {
    await deleteR2Best(env.SCRIBIX_MEDIA, r.audio_r2_key);
    ids.push(r.id);
  }
  if (!ids.length) return 0;

  const placeholders = ids.map((_, i) => `?${i + 1}`).join(",");
  await env.DB.prepare(
    `UPDATE transcripts SET audio_r2_key = NULL WHERE id IN (${placeholders})`
  ).bind(...ids).run();
  return ids.length;
}

function isoCutoff(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString().replace("T", " ").slice(0, 19);
}

async function runCleanup(env: Env): Promise<void> {
  const stuck = await sweepStuck(env, isoCutoff(PENDING_TTL_MS));
  const failed = await sweepFailed(env, isoCutoff(FAILED_TTL_MS));
  const expired = await sweepExpiredAudio(env, isoCutoff(AUDIO_TTL_MS));
  console.log(`cleanup: stuck=${stuck} failed=${failed} audio_expired=${expired}`);
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
