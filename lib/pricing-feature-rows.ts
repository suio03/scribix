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
  values: Record<PricingPlanId, string>;
};

type PricingFeatureT = (key: string) => string;

export function compactPricingRows(
  featureRows: PlanFeatureCopy[],
  t: PricingFeatureT
): PlanFeatureCopy[] {
  return compactRows(featureRows, t, [
    "monthlyMinutes",
    "maxFileLength",
    "aiFeatures",
    "processingQueue",
  ]);
}

export function compactBillingRows(
  featureRows: PlanFeatureCopy[],
  t: PricingFeatureT
): PlanFeatureCopy[] {
  return compactRows(featureRows, t, [
    "monthlyMinutes",
    "maxFileLength",
    "processingQueue",
    "aiFeatures",
  ]);
}

export function includedPaidRows(
  featureRows: PlanFeatureCopy[],
  t: PricingFeatureT
): PlanFeatureCopy[] {
  const rowsByKey = featureRowsByKey(featureRows);
  const exports = rowsByKey.get("exports");

  return [
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
    rowsByKey.get("accuracyModel"),
    rowsByKey.get("maxFileSize"),
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
