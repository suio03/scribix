// Engineering budgets, not plan entitlements or promised output counts.
export const AI_ANALYSIS = {
  version: "sentence-batch-v1",
  maxRangeMs: 180 * 60_000,
  batchMs: 10 * 60_000,
  batchChars: 20_000,
  overlapMs: 90_000,
  discoveryCapacity: 12,
  discoveryOutputTokens: 8_000,
  reviewOutputTokens: 6_000,
  maxDiscoveryCalls: 60,
  maxReviewCandidates: 240,
  reviewBatchSize: 5,
  maxResults: 120,
  topicRepeatPenalty: 0.05,
  globalConcurrency: 4,
  userConcurrency: 2,
  attempts: 3,
  leaseSeconds: 300,
} as const;
export type AnalysisRange = { startMs: number; endMs: number };
export function parseAnalysisRange(value: unknown, sourceDurationMs: number): AnalysisRange {
  const range = value === undefined ? { startMs: 0, endMs: sourceDurationMs } : value as AnalysisRange;
  if (!range || !Number.isSafeInteger(range.startMs) || !Number.isSafeInteger(range.endMs) ||
    range.startMs < 0 || range.endMs <= range.startMs || range.endMs > sourceDurationMs ||
    range.endMs - range.startMs > AI_ANALYSIS.maxRangeMs) throw new Error("invalid_analysis_range");
  return { startMs: range.startMs, endMs: range.endMs };
}
