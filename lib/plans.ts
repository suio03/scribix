// Tier config. Source of truth for caps, quotas, and Creem pricing display.
//
// `speechModels` is an array passed to AssemblyAI's `speech_models` field —
// AAI auto-routes within the array based on language support, falling back
// to later entries when earlier ones don't support the detected language.

export type Tier = "free" | "basic" | "pro";
export type BillingCycle = "monthly" | "yearly";

export const PLANS = {
  free: {
    minutesPerCycle: 30,
    maxFileSec: 30 * 60,
    maxFileBytes: 500 * 1024 * 1024,
    speechModels: ["universal-2"] as const,
  },
  basic: {
    monthly: { minutesPerCycle: 600 },
    yearly: { minutesPerCycle: 7200 },
    maxFileSec: 2 * 3600,
    maxFileBytes: 2 * 1024 * 1024 * 1024,
    speechModels: ["universal-3-pro", "universal-2"] as const,
  },
  pro: {
    monthly: { minutesPerCycle: 1800 },
    yearly: { minutesPerCycle: 21600 },
    maxFileSec: 10 * 3600,
    maxFileBytes: 5 * 1024 * 1024 * 1024,
    speechModels: ["universal-3-pro", "universal-2"] as const,
  },
} as const;

export function planFor(tier: Tier) {
  return PLANS[tier];
}

export function quotaMinutesFor(tier: Tier, cycle: BillingCycle | null | undefined): number {
  if (tier === "free") return PLANS.free.minutesPerCycle;
  const c: BillingCycle = cycle === "yearly" ? "yearly" : "monthly";
  return PLANS[tier][c].minutesPerCycle;
}

// Display pricing — used by the marketing pricing page only.
// Spec §1: monthly $9/$19, yearly 40% off ($64.80/yr, $136.80/yr).
export const PRICING_DISPLAY = {
  basic: {
    monthly: { amount: 9, currency: "USD" },
    yearly: { amount: 64.8, currency: "USD" },
  },
  pro: {
    monthly: { amount: 19, currency: "USD" },
    yearly: { amount: 136.8, currency: "USD" },
  },
} as const;
