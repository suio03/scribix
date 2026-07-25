export type QuotaPolicy = {
  allowPartial?: boolean;
  requireFullEstimate?: boolean;
};

export function hasInsufficientQuota(
  remainingMin: number,
  wantedMin: number,
  policy: QuotaPolicy = {}
): boolean {
  if (remainingMin >= wantedMin || policy.allowPartial) return false;
  return policy.requireFullEstimate === true || remainingMin * 2 < wantedMin;
}
