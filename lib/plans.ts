// Tier config. Source of truth for caps, quotas, and pricing display.
//
// `speechModels` is an array passed to AssemblyAI's `speech_models` field —
// AAI auto-routes within the array based on language support, falling back
// to later entries when earlier ones don't support the detected language.

export type Tier = "free" | "basic" | "pro";
export type BillingCycle = "monthly" | "yearly";
export type PlanVersion = "legacy" | "v2";

export const FREE_YOUTUBE_IMPORTS_PER_DAY = 10;
export const V2_FREE_YOUTUBE_IMPORTS_PER_DAY = 5;
export const AI_CHAT_QUESTION_CHAR_LIMIT = 4_000;
export const AI_CHAT_HISTORY_PAGE_SIZE = 200;
export const ONE_GIB = 1024 * 1024 * 1024;
// Stay below AssemblyAI's advertised 5 GB URL-ingest ceiling even if it is
// enforced using decimal bytes rather than GiB.
export const PAID_VIDEO_UPLOAD_BYTES = 4_900_000_000;

export const PLANS = {
  free: {
    // Free source-processing minutes are lifetime; YouTube caption imports reset daily.
    minutesPerCycle: 60,
    aiQuestionsLifetime: 3,
    youtubeImportsPerCycle: FREE_YOUTUBE_IMPORTS_PER_DAY,
    youtubeMaxVideoSec: 2 * 3600,
    // Free users may upload a long source file, but only their remaining
    // lifetime transcription minutes are processed.
    maxFileSec: 10 * 3600,
    // Audio remains single-PUT; direct video uses multipart upload.
    maxFileBytes: ONE_GIB,
    maxVideoUploadBytes: 2 * ONE_GIB,
    videoSourceRetentionDays: 7,
    maxVideoSourceStorageBytes: 5 * ONE_GIB,
    speechModels: ["universal-2"] as const,
  },
  basic: {
    // Grandfathered Basic users receive the same one-time Ask AI trial as Free.
    aiQuestionsLifetime: 3,
    monthly: { minutesPerCycle: 600, youtubeImportsPerCycle: 100 },
    yearly: { minutesPerCycle: 7200, youtubeImportsPerCycle: 1200 },
    youtubeMaxVideoSec: 10 * 3600,
    maxFileSec: 10 * 3600,
    maxFileBytes: ONE_GIB,
    maxVideoUploadBytes: PAID_VIDEO_UPLOAD_BYTES,
    videoSourceRetentionDays: 30,
    maxVideoSourceStorageBytes: 25 * ONE_GIB,
    speechModels: ["universal-3-5-pro", "universal-2"] as const,
  },
  pro: {
    monthly: { minutesPerCycle: 2400, youtubeImportsPerCycle: 1000 },
    // Yearly billing receives the same allowance as monthly billing. The
    // allowance resets monthly and unused usage does not roll over.
    yearly: { minutesPerCycle: 2400, youtubeImportsPerCycle: 1000 },
    aiQuestionsPerCycle: 300,
    youtubeMaxVideoSec: 10 * 3600,
    maxFileSec: 10 * 3600,
    maxFileBytes: ONE_GIB,
    maxVideoUploadBytes: PAID_VIDEO_UPLOAD_BYTES,
    videoSourceRetentionDays: 30,
    maxVideoSourceStorageBytes: 100 * ONE_GIB,
    speechModels: ["universal-3-5-pro", "universal-2"] as const,
  },
} as const;

// New subscriptions use these allowances. Legacy allowances above remain
// unchanged for customers who continue their existing subscriptions.
export const V2_PLANS = {
  basic: {
    minutesPerMonth: 600,
    aiQuestionsPerMonth: 100,
    youtubeImportsPerMonth: 500,
    socialAccounts: 6,
  },
  pro: {
    minutesPerMonth: 1800,
    aiQuestionsPerMonth: 300,
    youtubeImportsPerMonth: 1000,
    socialAccounts: 18,
  },
} as const;

export function planFor(tier: Tier) {
  return PLANS[tier];
}

export function quotaMinutesFor(tier: Tier, cycle: BillingCycle | null | undefined, version: PlanVersion | null = null): number {
  if (tier === "free") return PLANS.free.minutesPerCycle;
  if (version === "v2") return V2_PLANS[tier].minutesPerMonth;
  const c: BillingCycle = cycle === "yearly" ? "yearly" : "monthly";
  return PLANS[tier][c].minutesPerCycle;
}

export function youtubeImportsFor(tier: Tier, cycle: BillingCycle | null | undefined, version: PlanVersion | null = null): number {
  if (tier === "free") return version === "v2" ? V2_FREE_YOUTUBE_IMPORTS_PER_DAY : PLANS.free.youtubeImportsPerCycle;
  if (version === "v2") return V2_PLANS[tier].youtubeImportsPerMonth;
  const c: BillingCycle = cycle === "yearly" ? "yearly" : "monthly";
  return PLANS[tier][c].youtubeImportsPerCycle;
}

export function effectivePlanVersion(tier: Tier, storedVersion: PlanVersion | null, v2CheckoutEnabled: boolean): PlanVersion | null {
  return tier === "free" && v2CheckoutEnabled ? "v2" : storedVersion;
}

export function youtubeMaxVideoSecFor(tier: Tier): number {
  return PLANS[tier].youtubeMaxVideoSec;
}

export function aiQuestionsFor(
  tier: Tier,
  _cycle: BillingCycle | null | undefined,
  version: PlanVersion | null = null
): number {
  if (tier !== "free" && version === "v2") return V2_PLANS[tier].aiQuestionsPerMonth;
  return tier === "pro"
    ? PLANS.pro.aiQuestionsPerCycle
    : PLANS[tier].aiQuestionsLifetime;
}

export function hasMonthlyAiQuestions(tier: Tier, version: PlanVersion | null | undefined): boolean {
  return tier === "pro" || (tier === "basic" && version === "v2");
}

export function socialAccountLimitFor(tier: Tier, version: PlanVersion | null | undefined): number | null {
  if (tier === "free") return 0;
  return version === "v2" ? V2_PLANS[tier].socialAccounts : null;
}
