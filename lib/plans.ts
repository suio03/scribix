// Tier config. Phase 2 only ships free; basic/pro wire up in Phase 4.
// Source of truth for caps and quotas; consumed by quota reservation,
// init validation, and the account page.
//
// `speechModels` is an array passed to AssemblyAI's `speech_models` field —
// AAI auto-routes within the array based on language support, falling back
// to later entries when earlier ones don't support the detected language.

export type Tier = "free" | "basic" | "pro";

export const PLANS = {
  free: {
    minutesPerCycle: 30,
    maxFileSec: 30 * 60,
    maxFileBytes: 500 * 1024 * 1024,
    speechModels: ["universal-2"] as const,
  },
  basic: {
    minutesPerCycle: 600,
    maxFileSec: 2 * 3600,
    maxFileBytes: 2 * 1024 * 1024 * 1024,
    speechModels: ["universal-3-pro", "universal-2"] as const,
  },
  pro: {
    minutesPerCycle: 1800,
    maxFileSec: 10 * 3600,
    maxFileBytes: 5 * 1024 * 1024 * 1024,
    speechModels: ["universal-3-pro", "universal-2"] as const,
  },
} as const;

export function planFor(tier: Tier) {
  return PLANS[tier];
}
