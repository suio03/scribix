// Quota reservation and reconcile. Free tier is a one-time lifetime trial;
// yearly Pro receives a fresh allowance each month.
// All queries run against the D1 binding inside the Worker.

import { quotaMinutesFor } from "./plans";
import {
  maybeResetAllowancePeriod,
  type ResettableQuotaRow,
} from "./quota-period";
import {
  hasInsufficientQuota,
  type QuotaPolicy,
} from "./quota-policy";

export type UserQuotaRow = ResettableQuotaRow;

/**
 * Never settle more minutes than were reserved for this transcription range.
 * If AssemblyAI omits the processed duration, keep the reservation rather than
 * incorrectly refunding completed work.
 */
export function settledTranscriptionMinutes(
  processedDurationSec: number | null | undefined,
  reservedMin: number
): number {
  const safeReservedMin = Math.max(0, Math.ceil(reservedMin));
  if (
    typeof processedDurationSec !== "number" ||
    !Number.isFinite(processedDurationSec) ||
    processedDurationSec <= 0
  ) {
    return safeReservedMin;
  }
  return Math.min(Math.ceil(processedDurationSec / 60), safeReservedMin);
}

/**
 * Atomic reservation per §10.2.
 *
 * - `no_quota`: user has 0 minutes left this period.
 * - `insufficient_quota`: strict callers require the full estimate. Legacy
 *   callers keep the existing half-estimate threshold.
 * - With `allowPartial`, reserve `min(estimate, remaining)`.
 *
 * `remainingMin` / `capMin` are returned alongside errors so the caller can
 * shape user-facing messages ("X of Y minutes remaining").
 */
export async function reserveQuota(
  db: D1Database,
  userId: string,
  estimateMin: number,
  options: QuotaPolicy = {}
): Promise<
  | { reservedMin: number; remainingMin: number; capMin: number }
  | { error: "no_quota" | "insufficient_quota"; remainingMin: number; capMin: number }
  | { error: "user_not_found" }
> {
  const user = await db
    .prepare(
      `SELECT id, tier, billing_cycle, minutes_used_this_period,
              youtube_imports_used_this_period, ai_questions_used_this_period,
              period_started_at, period_ends_at
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
  if (hasInsufficientQuota(remaining, wantedMin, options)) {
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
  estimateMin: number,
  options: QuotaPolicy = {}
): Promise<
  | { ok: true; remainingMin: number; capMin: number }
  | { error: "no_quota" | "insufficient_quota"; remainingMin: number; capMin: number }
  | { error: "user_not_found" }
> {
  const user = await db
    .prepare(
      `SELECT id, tier, billing_cycle, minutes_used_this_period,
              youtube_imports_used_this_period, ai_questions_used_this_period,
              period_started_at, period_ends_at
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
  if (hasInsufficientQuota(remaining, wantedMin, options)) {
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
