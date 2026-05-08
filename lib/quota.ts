// Quota reservation and reconcile. Free tier is a one-time lifetime trial;
// paid tiers reset on Creem cycle events. All queries run against the D1
// binding inside the Worker.

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
 * Free tier is a one-time lifetime trial — no resets. Paid users reset on
 * Creem cycle events (Phase 4). This function is now a no-op kept in place
 * so callers don't need to change.
 */
export async function maybeResetFreePeriod(_db: D1Database, user: UserQuotaRow): Promise<UserQuotaRow> {
  return user;
}

/** Parses both D1's `YYYY-MM-DD HH:MM:SS` and ISO `YYYY-MM-DDTHH:MM:SS.sssZ`. */
export function parseDbDate(s: string): Date {
  return new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
}

/**
 * Atomic reservation per §10.2.
 *
 * - `no_quota`: user has 0 minutes left this period.
 * - `insufficient_quota`: user has some quota but `< estimate/2`. We reject
 *   up-front rather than half-transcribing — the spec's UX call to avoid
 *   silently truncated outputs (audio_end_at would still cap AAI billing).
 * - Otherwise reserve `min(estimate, remaining)`. If remaining < estimate
 *   (but ≥ estimate/2), the AAI submit's `audio_end_at` clips cleanly.
 *
 * `remainingMin` / `capMin` are returned alongside errors so the caller can
 * shape user-facing messages ("X of Y minutes remaining").
 */
export async function reserveQuota(
  db: D1Database,
  userId: string,
  estimateMin: number
): Promise<
  | { reservedMin: number; remainingMin: number; capMin: number }
  | { error: "no_quota" | "insufficient_quota"; remainingMin: number; capMin: number }
  | { error: "user_not_found" }
> {
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
  if (remaining === 0) return { error: "no_quota", remainingMin: 0, capMin: cap };

  const wantedMin = Math.max(1, Math.ceil(estimateMin));
  if (remaining * 2 < wantedMin) {
    return { error: "insufficient_quota", remainingMin: remaining, capMin: cap };
  }

  const reservedMin = Math.min(wantedMin, remaining);
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

  if (!result.meta?.changes) return { error: "no_quota", remainingMin: 0, capMin: cap };
  return { reservedMin, remainingMin: remaining - reservedMin, capMin: cap };
}

/**
 * Read-only pre-flight: tells the caller whether reserveQuota *would* succeed
 * for a given duration estimate. Used at /api/transcripts/init so we can
 * reject over-quota uploads before extraction + R2 PUT. Race window vs. the
 * atomic reserve at /start is acceptable — falls back to today's behavior.
 */
export async function checkQuota(
  db: D1Database,
  userId: string,
  estimateMin: number
): Promise<
  | { ok: true; remainingMin: number; capMin: number }
  | { error: "no_quota" | "insufficient_quota"; remainingMin: number; capMin: number }
  | { error: "user_not_found" }
> {
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
  if (remaining === 0) return { error: "no_quota", remainingMin: 0, capMin: cap };

  const wantedMin = Math.max(1, Math.ceil(estimateMin));
  if (remaining * 2 < wantedMin) {
    return { error: "insufficient_quota", remainingMin: remaining, capMin: cap };
  }
  return { ok: true, remainingMin: remaining, capMin: cap };
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
