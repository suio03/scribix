import { youtubeImportsFor } from "@/lib/plans";
import {
  maybeResetAllowancePeriod,
  type ResettableQuotaRow,
} from "@/lib/quota-period";
import { isTodayUtc } from "@/lib/utc-date";

type YouTubeQuotaRow = ResettableQuotaRow & {
  youtube_imports_period_started_at: string | null;
};

export type YouTubeQuotaResult =
  | { ok: true; remaining: number; cap: number }
  | { error: "youtube_quota_exceeded"; remaining: number; cap: number }
  | { error: "user_not_found" };

export async function checkYouTubeImportQuota(
  db: D1Database,
  userId: string
): Promise<YouTubeQuotaResult> {
  const user = await readYouTubeQuotaUser(db, userId);
  if (!user) return { error: "user_not_found" };

  const paidFresh = await maybeResetAllowancePeriod(db, user);
  const fresh = await maybeResetYouTubeDailyQuota(db, paidFresh);
  const cap = youtubeImportsFor(fresh.tier, fresh.billing_cycle);
  const remaining = Math.max(0, cap - fresh.youtube_imports_used_this_period);
  if (remaining <= 0) return { error: "youtube_quota_exceeded", remaining: 0, cap };
  return { ok: true, remaining, cap };
}

export async function reserveYouTubeImport(
  db: D1Database,
  userId: string
): Promise<YouTubeQuotaResult> {
  const user = await readYouTubeQuotaUser(db, userId);
  if (!user) return { error: "user_not_found" };

  const paidFresh = await maybeResetAllowancePeriod(db, user);
  const fresh = await maybeResetYouTubeDailyQuota(db, paidFresh);
  const cap = youtubeImportsFor(fresh.tier, fresh.billing_cycle);
  const remaining = Math.max(0, cap - fresh.youtube_imports_used_this_period);
  if (remaining <= 0) return { error: "youtube_quota_exceeded", remaining: 0, cap };

  const dailyWindowClause =
    fresh.tier === "free"
      ? "AND (youtube_imports_period_started_at IS NULL OR date(youtube_imports_period_started_at) = date('now'))"
      : "";

  const result = await db
    .prepare(
      `UPDATE users
          SET youtube_imports_used_this_period = youtube_imports_used_this_period + 1
        WHERE id = ?1
          AND deleted_at IS NULL
          ${dailyWindowClause}
          AND youtube_imports_used_this_period + 1 <= ?2`
    )
    .bind(userId, cap)
    .run();

  if (!result.meta?.changes) {
    return { error: "youtube_quota_exceeded", remaining: 0, cap };
  }
  return { ok: true, remaining: remaining - 1, cap };
}

export async function refundYouTubeImport(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE users
          SET youtube_imports_used_this_period = MAX(0, youtube_imports_used_this_period - 1)
        WHERE id = ?1
          AND deleted_at IS NULL`
    )
    .bind(userId)
    .run();
}

async function readYouTubeQuotaUser(
  db: D1Database,
  userId: string
): Promise<YouTubeQuotaRow | null> {
  return db
    .prepare(
      `SELECT id, tier, billing_cycle, minutes_used_this_period,
              youtube_imports_used_this_period, youtube_imports_period_started_at,
              period_started_at, period_ends_at
         FROM users
        WHERE id = ?1
          AND deleted_at IS NULL`
    )
    .bind(userId)
    .first<YouTubeQuotaRow>();
}

async function maybeResetYouTubeDailyQuota(
  db: D1Database,
  user: YouTubeQuotaRow
): Promise<YouTubeQuotaRow> {
  if (user.tier !== "free") return user;
  if (user.youtube_imports_period_started_at && isTodayUtc(user.youtube_imports_period_started_at)) {
    return user;
  }

  await db
    .prepare(
      `UPDATE users
          SET youtube_imports_used_this_period = 0,
              youtube_imports_period_started_at = CURRENT_TIMESTAMP
        WHERE id = ?1
          AND deleted_at IS NULL
          AND (youtube_imports_period_started_at IS NULL
            OR date(youtube_imports_period_started_at) < date('now'))`
    )
    .bind(user.id)
    .run();

  return {
    ...user,
    youtube_imports_used_this_period: 0,
    youtube_imports_period_started_at: new Date().toISOString(),
  };
}
