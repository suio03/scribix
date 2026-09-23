// Canonical v2 pricing-page facts. Checkout availability is controlled separately.
import { ONE_GIB, PLANS, V2_PLANS } from "@/lib/plans";

export const PRICING_V2 = {
  free: {
    monthlyUsd: 0,
    processingMinutes: PLANS.free.minutesPerCycle,
    socialAccounts: 0,
    askAiQuestions: PLANS.free.aiQuestionsLifetime,
    sourceStorageGiB: PLANS.free.maxVideoSourceStorageBytes / ONE_GIB,
    sourceRetentionDays: PLANS.free.videoSourceRetentionDays,
  },
  starter: {
    monthlyUsd: 29,
    yearlyUsd: 174,
    processingMinutes: V2_PLANS.basic.minutesPerMonth,
    socialAccounts: V2_PLANS.basic.socialAccounts,
    askAiQuestions: V2_PLANS.basic.aiQuestionsPerMonth,
    youtubeImports: V2_PLANS.basic.youtubeImportsPerMonth,
    sourceStorageGiB: PLANS.basic.maxVideoSourceStorageBytes / ONE_GIB,
    sourceRetentionDays: PLANS.basic.videoSourceRetentionDays,
  },
  pro: {
    monthlyUsd: 69,
    yearlyUsd: 414,
    processingMinutes: V2_PLANS.pro.minutesPerMonth,
    socialAccounts: V2_PLANS.pro.socialAccounts,
    askAiQuestions: V2_PLANS.pro.aiQuestionsPerMonth,
    youtubeImports: V2_PLANS.pro.youtubeImportsPerMonth,
    sourceStorageGiB: PLANS.pro.maxVideoSourceStorageBytes / ONE_GIB,
    sourceRetentionDays: PLANS.pro.videoSourceRetentionDays,
  },
} as const;
