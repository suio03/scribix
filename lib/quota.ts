// Quota reservation and reconcile. Free tier is a one-time lifetime trial;
// yearly Pro receives a fresh allowance each month.
// All queries run against the D1 binding inside the Worker.

import { quotaMinutesFor } from "./plans";
import {
  maybeResetAllowancePeriod,
  type ResettableQuotaRow,
} from "./quota-period";

export type UserQuotaRow = ResettableQuotaRow;

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
      `SELECT id, tier, billing_cycle, minutes_used_this_period,
              youtube_imports_used_this_period, period_started_at, period_ends_at
         FROM users WHERE id = ?1 AND deleted_at IS NULL`
    )
    .bind(userId)
    .first<UserQuotaRow>();
  if (!user) return { error: "user_not_found" };

  const fresh = await maybeResetAllowancePeriod(db, user);
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
      `SELECT id, tier, billing_cycle, minutes_used_this_period,
              youtube_imports_used_this_period, period_started_at, period_ends_at
         FROM users WHERE id = ?1 AND deleted_at IS NULL`
    )
    .bind(userId)
    .first<UserQuotaRow>();
  if (!user) return { error: "user_not_found" };

  const fresh = await maybeResetAllowancePeriod(db, user);
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
 * this runs at most once per transcript). When `submittedAt` is provided,
 * an older allowance window cannot refund or charge the current window.
 */
export async function reconcileQuota(
  db: D1Database,
  userId: string,
  reservedMin: number,
  actualMin: number,
  submittedAt?: string | null
): Promise<void> {
  const delta = actualMin - reservedMin;
  if (delta === 0) return;
  await db
    .prepare(
      `UPDATE users
          SET minutes_used_this_period = MAX(0, minutes_used_this_period + ?1)
        WHERE id = ?2
          AND deleted_at IS NULL
          AND (?3 IS NULL OR julianday(period_started_at) <= julianday(?3))`
    )
    .bind(delta, userId, submittedAt ?? null)
    .run();
}
