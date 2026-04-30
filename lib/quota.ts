// Quota reservation, reconcile, and lazy free-tier period reset.
// All queries run against the D1 binding inside the Worker.

import type { BillingCycle, Tier } from "./plans";
import { quotaMinutesFor } from "./plans";

export type UserQuotaRow = {
  id: string;
  tier: Tier;
  billing_cycle: BillingCycle | null;
  minutes_used_this_period: number;
  period_started_at: string;
  period_ends_at: string;
};

/**
 * For free users, the period rolls forward 30 days at a time on read.
 * Paid users reset on Creem cycle events (Phase 4) — never lazy-reset paid.
 * Race on concurrent reads at the boundary is harmless: both writes converge.
 */
export async function maybeResetFreePeriod(db: D1Database, user: UserQuotaRow): Promise<UserQuotaRow> {
  if (user.tier !== "free") return user;
  const now = new Date();
  const ends = parseDbDate(user.period_ends_at);
  if (now < ends) return user;

  await db
    .prepare(
      `UPDATE users
          SET minutes_used_this_period = 0,
              period_started_at = period_ends_at,
              period_ends_at    = datetime(period_ends_at, '+30 days')
        WHERE id = ?1 AND tier = 'free'`
    )
    .bind(user.id)
    .run();

  const refreshed = await db
    .prepare(
      `SELECT id, tier, billing_cycle, minutes_used_this_period, period_started_at, period_ends_at
         FROM users WHERE id = ?1`
    )
    .bind(user.id)
    .first<UserQuotaRow>();
  return refreshed ?? user;
}

/** Parses both D1's `YYYY-MM-DD HH:MM:SS` and ISO `YYYY-MM-DDTHH:MM:SS.sssZ`. */
export function parseDbDate(s: string): Date {
  return new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
}

/**
 * Atomic reservation. Returns the actual minutes reserved (capped to remaining)
 * or null if the user has no quota left at all.
 *
 * Reserved = min(estimateMin, remaining). We never reserve a fraction of a minute.
 */
export async function reserveQuota(
  db: D1Database,
  userId: string,
  estimateMin: number
): Promise<{ reservedMin: number } | { error: "no_quota" | "user_not_found" }> {
  const user = await db
    .prepare(
      `SELECT id, tier, billing_cycle, minutes_used_this_period, period_started_at, period_ends_at
         FROM users WHERE id = ?1 AND deleted_at IS NULL`
    )
    .bind(userId)
    .first<UserQuotaRow>();
  if (!user) return { error: "user_not_found" };

  const fresh = await maybeResetFreePeriod(db, user);
  const cap = quotaMinutesFor(fresh.tier, fresh.billing_cycle);
  const remaining = Math.max(0, cap - fresh.minutes_used_this_period);
  if (remaining === 0) return { error: "no_quota" };

  const reservedMin = Math.min(Math.max(1, Math.ceil(estimateMin)), remaining);
  const result = await db
    .prepare(
      `UPDATE users
          SET minutes_used_this_period = minutes_used_this_period + ?1
        WHERE id = ?2
          AND deleted_at IS NULL
          AND minutes_used_this_period + ?1 <= ?3`
    )
    .bind(reservedMin, userId, cap)
    .run();

  if (!result.meta?.changes) return { error: "no_quota" };
  return { reservedMin };
}

/**
 * Webhook-time reconcile. Adjust counter from `reserved` to `actual`.
 * Idempotency is the caller's responsibility (the §9.2 atomic guard ensures
 * this runs at most once per transcript).
 */
export async function reconcileQuota(
  db: D1Database,
  userId: string,
  reservedMin: number,
  actualMin: number
): Promise<void> {
  const delta = actualMin - reservedMin;
  if (delta === 0) return;
  await db
    .prepare(
      `UPDATE users
          SET minutes_used_this_period = MAX(0, minutes_used_this_period + ?1)
        WHERE id = ?2 AND deleted_at IS NULL`
    )
    .bind(delta, userId)
    .run();
}
