import { PLANS } from "@/lib/plans";
import { marketingGigabytes } from "@/lib/pricing-facts";
import { assertLocalizedItemCount } from "@/lib/localized-items";

export type PricingPlanId = "free" | "starter" | "pro";

export type PlanFeatureKey =
  | "transcriptFiles"
  | "monthlyMinutes"
  | "youtubeCaptionImports"
  | "maxYoutubeCaptionVideo"
  | "maxFileLength"
  | "maxFileSize"
  | "processingQueue"
  | "accuracyModel"
  | "aiTranslation"
  | "aiFeatures"
  | "speakerLabels"
  | "exports"
  | "aiSummaries";

export type PlanFeatureCopy = {
  key: PlanFeatureKey;
  label: string;
  annualLabel?: string;
  values: Record<PricingPlanId, string>;
  annualValues?: Partial<Record<PricingPlanId, string>>;
};

type PricingFeatureT = {
  (key: string, values?: Record<string, number>): string;
  raw(key: string): unknown;
};

const PRICING_PLAN_IDS = ["free", "starter", "pro"] as const;

const PRICING_FEATURE_KEYS = [
  "transcriptFiles",
  "monthlyMinutes",
  "youtubeCaptionImports",
  "maxYoutubeCaptionVideo",
  "maxFileLength",
  "maxFileSize",
  "processingQueue",
  "accuracyModel",
  "aiTranslation",
  "speakerLabels",
  "exports",
  "aiSummaries",
] as const satisfies readonly PlanFeatureKey[];

export function buildPricingFeatureRows(
  t: PricingFeatureT
): PlanFeatureCopy[] {
  assertLocalizedItemCount(
    t.raw("featureRows"),
    PRICING_FEATURE_KEYS,
    "PricingPage.featureRows"
  );

  return PRICING_FEATURE_KEYS.map((key, index) => ({
    key,
    label: t(`featureRows.${index}.label`),
    values: Object.fromEntries(
      PRICING_PLAN_IDS.map((planId) => [
        planId,
        t(
          `featureRows.${index}.values.${planId}`,
          pricingValues(key, planId)
        ),
      ])
    ) as Record<PricingPlanId, string>,
  }));
}

export function compactPricingRows(
  featureRows: PlanFeatureCopy[],
  t: PricingFeatureT
): PlanFeatureCopy[] {
  return compactRows(featureRows, t, [
    "monthlyMinutes",
    "aiFeatures",
    "maxFileLength",
    "accuracyModel",
    "youtubeCaptionImports",
  ]);
}

export function compactBillingRows(
  featureRows: PlanFeatureCopy[],
  t: PricingFeatureT
): PlanFeatureCopy[] {
  return compactRows(featureRows, t, [
    "monthlyMinutes",
    "aiFeatures",
    "maxFileLength",
    "accuracyModel",
    "youtubeCaptionImports",
  ]);
}

export function includedPaidRows(
  featureRows: PlanFeatureCopy[],
  t: PricingFeatureT
): PlanFeatureCopy[] {
  const rowsByKey = featureRowsByKey(featureRows);
  const exports = rowsByKey.get("exports");

  return [
    rowsByKey.get("aiSummaries"),
    rowsByKey.get("aiTranslation"),
    exports
      ? {
          ...exports,
          values: {
            ...exports.values,
            starter: `${exports.values.starter} - ${t("exportFormats")}`,
            pro: `${exports.values.pro} - ${t("exportFormats")}`,
          },
        }
      : null,
    rowsByKey.get("speakerLabels"),
    rowsByKey.get("maxFileSize"),
    rowsByKey.get("maxYoutubeCaptionVideo"),
  ].filter((row): row is PlanFeatureCopy => Boolean(row));
}

function compactRows(
  featureRows: PlanFeatureCopy[],
  t: PricingFeatureT,
  keys: Array<PlanFeatureKey | "aiFeatures">
): PlanFeatureCopy[] {
  const rowsByKey = featureRowsByKey(featureRows);
  const aiFeatures = mergedAiFeatures(rowsByKey, t);

  return keys
    .map((key) => (key === "aiFeatures" ? aiFeatures : rowsByKey.get(key)))
    .filter((row): row is PlanFeatureCopy => Boolean(row));
}

function mergedAiFeatures(
  rowsByKey: Map<PlanFeatureKey, PlanFeatureCopy>,
  t: PricingFeatureT
): PlanFeatureCopy | null {
  const aiTranslation = rowsByKey.get("aiTranslation");
  const aiSummaries = rowsByKey.get("aiSummaries");
  if (!aiTranslation || !aiSummaries) return null;

  return {
    key: "aiFeatures",
    label: t("aiFeatures"),
    values: {
      free: mergeCell(aiTranslation.values.free, aiSummaries.values.free),
      starter: t("included"),
      pro: t("included"),
    },
  };
}

function mergeCell(a: string, b: string) {
  return a === b ? a : `${a} / ${b}`;
}

function featureRowsByKey(featureRows: PlanFeatureCopy[]) {
  return new Map(featureRows.map((row) => [row.key, row]));
}

function pricingValues(
  key: PlanFeatureKey,
  planId: PricingPlanId
): Record<string, number> {
  const tier = planId === "starter" ? "basic" : planId;
  const plan = PLANS[tier];
  let minutes: number;
  let imports: number;
  if (tier === "free") {
    minutes = PLANS.free.minutesPerCycle;
    imports = PLANS.free.youtubeImportsPerCycle;
  } else {
    minutes = PLANS[tier].monthly.minutesPerCycle;
    imports = PLANS[tier].monthly.youtubeImportsPerCycle;
  }

  if (key === "transcriptFiles" || key === "monthlyMinutes") {
    return { minutes, hours: minutes / 60 };
  }
  if (key === "youtubeCaptionImports") {
    return { imports };
  }
  if (key === "maxYoutubeCaptionVideo") {
    return { hours: plan.youtubeMaxVideoSec / 3600 };
  }
  if (key === "maxFileLength") {
    return {
      minutes: plan.maxFileSec / 60,
      hours: plan.maxFileSec / 3600,
      freeMinutes: PLANS.free.minutesPerCycle,
    };
  }
  if (key === "maxFileSize") {
    return {
      videoGb: marketingGigabytes(plan.maxVideoUploadBytes),
      audioGb: marketingGigabytes(plan.maxFileBytes),
    };
  }
  return {};
}
