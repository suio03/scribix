import type { BillingCycle, Tier } from "@/lib/plans";
import { youtubeImportsFor } from "@/lib/plans";

type YouTubeQuotaRow = {
  id: string;
  tier: Tier;
  billing_cycle: BillingCycle | null;
  youtube_imports_used_this_period: number;
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

  const cap = youtubeImportsFor(user.tier, user.billing_cycle);
  const remaining = Math.max(0, cap - user.youtube_imports_used_this_period);
  if (remaining <= 0) return { error: "youtube_quota_exceeded", remaining: 0, cap };
  return { ok: true, remaining, cap };
}

export async function reserveYouTubeImport(
  db: D1Database,
  userId: string
): Promise<YouTubeQuotaResult> {
  const user = await readYouTubeQuotaUser(db, userId);
  if (!user) return { error: "user_not_found" };

  const cap = youtubeImportsFor(user.tier, user.billing_cycle);
  const remaining = Math.max(0, cap - user.youtube_imports_used_this_period);
  if (remaining <= 0) return { error: "youtube_quota_exceeded", remaining: 0, cap };

  const result = await db
    .prepare(
      `UPDATE users
          SET youtube_imports_used_this_period = youtube_imports_used_this_period + 1
        WHERE id = ?1
          AND deleted_at IS NULL
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
      `SELECT id, tier, billing_cycle, youtube_imports_used_this_period
         FROM users
        WHERE id = ?1
          AND deleted_at IS NULL`
    )
    .bind(userId)
    .first<YouTubeQuotaRow>();
}
