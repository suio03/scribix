const YOUTUBE_INSPECT_WINDOW_SEC = 60;
const YOUTUBE_INSPECT_MAX_PER_WINDOW = 12;

export type YouTubeInspectRateLimitResult =
  | { ok: true; remaining: number; limit: number; retryAfterSec: 0 }
  | { error: "youtube_inspect_rate_limited"; remaining: 0; limit: number; retryAfterSec: number };

type YouTubeInspectRateLimitRow = {
  window_started_at: number;
  count: number;
};

export async function reserveYouTubeInspectAttempt(
  db: D1Database,
  userId: string
): Promise<YouTubeInspectRateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiredBeforeSec = nowSec - YOUTUBE_INSPECT_WINDOW_SEC;
  const result = await db
    .prepare(
      `INSERT INTO youtube_inspect_rate_limits
         (user_id, window_started_at, count, updated_at)
       VALUES (?1, ?2, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         window_started_at = CASE
           WHEN youtube_inspect_rate_limits.window_started_at <= ?3 THEN ?2
           ELSE youtube_inspect_rate_limits.window_started_at
         END,
         count = CASE
           WHEN youtube_inspect_rate_limits.window_started_at <= ?3 THEN 1
           ELSE youtube_inspect_rate_limits.count + 1
         END,
         updated_at = CURRENT_TIMESTAMP
       WHERE youtube_inspect_rate_limits.window_started_at <= ?3
          OR youtube_inspect_rate_limits.count < ?4`
    )
    .bind(userId, nowSec, expiredBeforeSec, YOUTUBE_INSPECT_MAX_PER_WINDOW)
    .run();

  if (result.meta?.changes) {
    const row = await readYouTubeInspectRateLimit(db, userId);
    const count = row?.count ?? 1;
    return {
      ok: true,
      remaining: Math.max(0, YOUTUBE_INSPECT_MAX_PER_WINDOW - count),
      limit: YOUTUBE_INSPECT_MAX_PER_WINDOW,
      retryAfterSec: 0,
    };
  }

  const row = await readYouTubeInspectRateLimit(db, userId);
  const retryAfterSec = row
    ? Math.max(1, row.window_started_at + YOUTUBE_INSPECT_WINDOW_SEC - nowSec)
    : YOUTUBE_INSPECT_WINDOW_SEC;
  return {
    error: "youtube_inspect_rate_limited",
    remaining: 0,
    limit: YOUTUBE_INSPECT_MAX_PER_WINDOW,
    retryAfterSec,
  };
}

async function readYouTubeInspectRateLimit(
  db: D1Database,
  userId: string
): Promise<YouTubeInspectRateLimitRow | null> {
  return db
    .prepare(
      `SELECT window_started_at, count
         FROM youtube_inspect_rate_limits
        WHERE user_id = ?1`
    )
    .bind(userId)
    .first<YouTubeInspectRateLimitRow>();
}
