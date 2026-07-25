import { PLANS, PRICING_DISPLAY } from "@/lib/plans";

export const PRICING_FACTS = {
  freeMinutes: PLANS.free.minutesPerCycle,
  proMinutes: PLANS.pro.monthly.minutesPerCycle,
  proHours: PLANS.pro.maxFileSec / 3600,
  freeVideoGb: marketingGigabytes(PLANS.free.maxVideoUploadBytes),
  proVideoGb: marketingGigabytes(PLANS.pro.maxVideoUploadBytes),
  audioGb: marketingGigabytes(PLANS.pro.maxFileBytes),
  savingsPercent: Math.round(
    (1 -
      PRICING_DISPLAY.pro.yearly.amount /
        (PRICING_DISPLAY.pro.monthly.amount * 12)) *
      100
  ),
} as const;

export function marketingGigabytes(bytes: number) {
  return Math.round(bytes / 1_000_000_000);
}
