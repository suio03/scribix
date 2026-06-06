// Tier config. Source of truth for caps, quotas, and pricing display.
//
// `speechModels` is an array passed to AssemblyAI's `speech_models` field —
// AAI auto-routes within the array based on language support, falling back
// to later entries when earlier ones don't support the detected language.

export type Tier = "free" | "basic" | "pro";
export type BillingCycle = "monthly" | "yearly";

export const PLANS = {
  free: {
    // One-time lifetime trial — never resets. Quota.maybeResetFreePeriod is a no-op for free.
    minutesPerCycle: 45,
    maxFileSec: 45 * 60,
    // maxFileBytes applies post-extraction (mp3); maxVideoUploadBytes caps the
    // raw video upload before extraction, so a malicious client can't claim
    // isVideo=true to PUT an unbounded blob to R2.
    maxFileBytes: 500 * 1024 * 1024,
    maxVideoUploadBytes: 1 * 1024 * 1024 * 1024,
    speechModels: ["universal-2"] as const,
  },
  basic: {
    monthly: { minutesPerCycle: 600 },
    yearly: { minutesPerCycle: 7200 },
    maxFileSec: 1 * 3600,
    maxFileBytes: 2 * 1024 * 1024 * 1024,
    // Capped at 1 GB across tiers: browser-side ffmpeg.wasm / Web Audio
    // extraction is unreliable beyond this. Users with larger videos are
    // guided to extract audio locally and upload the audio file instead.
    maxVideoUploadBytes: 1 * 1024 * 1024 * 1024,
    speechModels: ["universal-3-pro", "universal-2"] as const,
  },
  pro: {
    monthly: { minutesPerCycle: 1800 },
    yearly: { minutesPerCycle: 21600 },
    maxFileSec: 10 * 3600,
    maxFileBytes: 5 * 1024 * 1024 * 1024,
    maxVideoUploadBytes: 1 * 1024 * 1024 * 1024,
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

// Display pricing — keep in sync with the public Starter/Pro pricing model.
export const PRICING_DISPLAY = {
  basic: {
    monthly: { amount: 12, currency: "USD" },
    yearly: { amount: 99, currency: "USD" },
  },
  pro: {
    monthly: { amount: 19, currency: "USD" },
    yearly: { amount: 149, currency: "USD" },
  },
} as const;
