import type { BillingCycle, Tier } from "@/lib/plans";

export type ResettableQuotaRow = {
  id: string;
  tier: Tier;
  billing_cycle: BillingCycle | null;
  minutes_used_this_period: number;
  youtube_imports_used_this_period: number;
  period_started_at: string;
  period_ends_at: string;
};

type AllowanceWindow = {
  startsAt: Date;
  endsAt: Date;
};

/**
 * Pro is billed yearly but receives a fresh monthly allowance. The Paddle
 * billing period stays in `period_ends_at`; `period_started_at` tracks the
 * current allowance window for yearly Pro subscriptions.
 */
export async function maybeResetAllowancePeriod<T extends ResettableQuotaRow>(
  db: D1Database,
  user: T,
  now = new Date()
): Promise<T> {
  if (user.tier !== "pro" || user.billing_cycle !== "yearly") return user;

  const window = yearlyMonthlyAllowanceWindow(user.period_ends_at, now);
  if (!window) return user;

  const currentStart = parseDbDate(user.period_started_at);
  if (currentStart && currentStart.getTime() >= window.startsAt.getTime()) return user;

  const nextStart = window.startsAt.toISOString();
  const result = await db
    .prepare(
      `UPDATE users
          SET minutes_used_this_period = 0,
              youtube_imports_used_this_period = 0,
              period_started_at = ?1
        WHERE id = ?2
          AND deleted_at IS NULL
          AND tier = 'pro'
          AND billing_cycle = 'yearly'
          AND period_started_at = ?3`
    )
    .bind(nextStart, user.id, user.period_started_at)
    .run();

  if (result.meta?.changes) {
    return {
      ...user,
      minutes_used_this_period: 0,
      youtube_imports_used_this_period: 0,
      period_started_at: nextStart,
    };
  }

  const fresh = await db
    .prepare(
      `SELECT id, tier, billing_cycle, minutes_used_this_period,
              youtube_imports_used_this_period, period_started_at, period_ends_at
         FROM users
        WHERE id = ?1
          AND deleted_at IS NULL`
    )
    .bind(user.id)
    .first<ResettableQuotaRow>();

  return fresh ? ({ ...user, ...fresh } as T) : user;
}

export function allowancePeriodEndsAt(
  user: Pick<ResettableQuotaRow, "tier" | "billing_cycle" | "period_ends_at">,
  now = new Date()
): string {
  if (user.tier !== "pro" || user.billing_cycle !== "yearly") {
    return user.period_ends_at;
  }

  return yearlyMonthlyAllowanceWindow(user.period_ends_at, now)?.endsAt.toISOString() ??
    user.period_ends_at;
}

/**
 * Derives the active monthly window from Paddle's yearly period end. Each
 * boundary is calculated from the same anchor so dates such as the 31st do
 * not drift after a shorter month.
 */
export function yearlyMonthlyAllowanceWindow(
  periodEndsAt: string,
  now = new Date()
): AllowanceWindow | null {
  const annualEnd = parseDbDate(periodEndsAt);
  if (!annualEnd || now.getTime() >= annualEnd.getTime()) return null;

  for (let month = 1; month <= 12; month += 1) {
    const startsAt = shiftUtcMonthsClamped(annualEnd, -month);
    const endsAt = shiftUtcMonthsClamped(annualEnd, -(month - 1));
    if (now.getTime() >= startsAt.getTime() && now.getTime() < endsAt.getTime()) {
      return { startsAt, endsAt };
    }
  }

  return null;
}

/** Parses both D1's `YYYY-MM-DD HH:MM:SS` and ISO timestamps. */
export function parseDbDate(value: string): Date | null {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftUtcMonthsClamped(anchor: Date, offset: number): Date {
  const monthIndex = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + offset;
  const year = Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(anchor.getUTCDate(), lastDay),
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds()
    )
  );
}
