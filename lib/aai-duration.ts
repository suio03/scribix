export type ResolvedAaiDuration = {
  reportedDurationSec: number | null;
  processedDurationSec: number | null;
  inferredSourceDurationSec: number | null;
};

/**
 * AssemblyAI currently returns the processed range for capped jobs, while its
 * API documentation describes `audio_duration` as the full source duration.
 * Resolve both shapes without ever storing more than the server processing
 * boundary as processed time.
 */
export function resolveAaiDuration(
  audioDurationSec: number | null | undefined,
  processingLimitSec: number | null | undefined
): ResolvedAaiDuration {
  const reportedDurationSec =
    typeof audioDurationSec === "number" &&
    Number.isFinite(audioDurationSec) &&
    audioDurationSec > 0
      ? Math.round(audioDurationSec)
      : null;
  const safeProcessingLimitSec =
    typeof processingLimitSec === "number" &&
    Number.isFinite(processingLimitSec) &&
    processingLimitSec > 0
      ? Math.round(processingLimitSec)
      : null;

  if (reportedDurationSec === null) {
    return {
      reportedDurationSec: null,
      processedDurationSec: null,
      inferredSourceDurationSec: null,
    };
  }
  if (safeProcessingLimitSec === null) {
    return {
      reportedDurationSec,
      processedDurationSec: reportedDurationSec,
      inferredSourceDurationSec: null,
    };
  }

  return {
    reportedDurationSec,
    processedDurationSec: Math.min(
      reportedDurationSec,
      safeProcessingLimitSec
    ),
    // If AAI reports less than the cap, the source ended naturally. If it
    // reports more than the cap, it is using the documented full-source
    // duration semantics. Equality is the only ambiguous case.
    inferredSourceDurationSec:
      reportedDurationSec === safeProcessingLimitSec
        ? null
        : reportedDurationSec,
  };
}
