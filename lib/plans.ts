// Tier config. Source of truth for caps, quotas, and pricing display.
//
// `speechModels` is an array passed to AssemblyAI's `speech_models` field —
// AAI auto-routes within the array based on language support, falling back
// to later entries when earlier ones don't support the detected language.

export type Tier = "free" | "basic" | "pro";
export type BillingCycle = "monthly" | "yearly";

export const FREE_YOUTUBE_IMPORTS_PER_DAY = 10;
export const ONE_GIB = 1024 * 1024 * 1024;
// Stay below AssemblyAI's advertised 5 GB URL-ingest ceiling even if it is
// enforced using decimal bytes rather than GiB.
export const PAID_VIDEO_UPLOAD_BYTES = 4_900_000_000;

export const PLANS = {
  free: {
    // Free transcript minutes are lifetime; YouTube caption imports reset daily.
    minutesPerCycle: 45,
    youtubeImportsPerCycle: FREE_YOUTUBE_IMPORTS_PER_DAY,
    youtubeMaxVideoSec: 2 * 3600,
    maxFileSec: 45 * 60,
    // Audio remains single-PUT; direct video uses multipart upload.
    maxFileBytes: ONE_GIB,
    maxVideoUploadBytes: 2 * ONE_GIB,
    speechModels: ["universal-2"] as const,
  },
  basic: {
    monthly: { minutesPerCycle: 600, youtubeImportsPerCycle: 100 },
    yearly: { minutesPerCycle: 7200, youtubeImportsPerCycle: 1200 },
    youtubeMaxVideoSec: 10 * 3600,
    maxFileSec: 10 * 3600,
    maxFileBytes: ONE_GIB,
    maxVideoUploadBytes: PAID_VIDEO_UPLOAD_BYTES,
    speechModels: ["universal-3-5-pro", "universal-2"] as const,
  },
  pro: {
    monthly: { minutesPerCycle: 2400, youtubeImportsPerCycle: 1000 },
    yearly: { minutesPerCycle: 28800, youtubeImportsPerCycle: 12000 },
    youtubeMaxVideoSec: 10 * 3600,
    maxFileSec: 10 * 3600,
    maxFileBytes: ONE_GIB,
    maxVideoUploadBytes: PAID_VIDEO_UPLOAD_BYTES,
    speechModels: ["universal-3-5-pro", "universal-2"] as const,
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

export function youtubeImportsFor(tier: Tier, cycle: BillingCycle | null | undefined): number {
  if (tier === "free") return PLANS.free.youtubeImportsPerCycle;
  const c: BillingCycle = cycle === "yearly" ? "yearly" : "monthly";
  return PLANS[tier][c].youtubeImportsPerCycle;
}

export function youtubeMaxVideoSecFor(tier: Tier): number {
  return PLANS[tier].youtubeMaxVideoSec;
}

// Display pricing — keep in sync with the public Starter/Pro pricing model.
export const PRICING_DISPLAY = {
  basic: {
    monthly: { amount: 12, currency: "USD" },
    yearly: { amount: 99, currency: "USD" },
  },
  pro: {
    monthly: { amount: 19, currency: "USD" },
    yearly: { amount: 179, currency: "USD" },
  },
} as const;
