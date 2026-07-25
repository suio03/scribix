export type PartialTranscriptInfo = {
  sourceDurationSec: number | null;
  processedDurationSec: number;
  sourceMinutes: number | null;
  processedMinutes: number;
};

export function partialTranscriptInfo({
  processedDurationSec,
  sourceDurationSec,
  processingLimitSec,
  partialRequested,
}: {
  processedDurationSec: number | null | undefined;
  sourceDurationSec: number | null | undefined;
  processingLimitSec: number | null | undefined;
  partialRequested: boolean;
}): PartialTranscriptInfo | null {
  if (
    typeof processingLimitSec !== "number" ||
    !Number.isFinite(processingLimitSec) ||
    processingLimitSec <= 0
  ) {
    return null;
  }

  const knownSourceDurationSec =
    typeof sourceDurationSec === "number" &&
    Number.isFinite(sourceDurationSec) &&
    sourceDurationSec > 0
      ? sourceDurationSec
      : null;
  const knownProcessedDurationSec =
    typeof processedDurationSec === "number" &&
    Number.isFinite(processedDurationSec) &&
    processedDurationSec > 0
      ? processedDurationSec
      : null;

  if (
    knownSourceDurationSec !== null &&
    processingLimitSec >= knownSourceDurationSec
  ) {
    return null;
  }
  if (
    knownSourceDurationSec === null &&
    (!partialRequested ||
      (knownProcessedDurationSec !== null &&
        knownProcessedDurationSec < processingLimitSec))
  ) {
    return null;
  }

  const effectiveProcessedDurationSec = Math.min(
    knownProcessedDurationSec ?? processingLimitSec,
    processingLimitSec
  );
  return {
    sourceDurationSec: knownSourceDurationSec,
    processedDurationSec: effectiveProcessedDurationSec,
    sourceMinutes:
      knownSourceDurationSec === null
        ? null
        : Math.ceil(knownSourceDurationSec / 60),
    processedMinutes: Math.ceil(effectiveProcessedDurationSec / 60),
  };
}

export function partialTranscriptExportLabel(info: PartialTranscriptInfo): string {
  if (info.sourceMinutes === null) {
    return `Partial transcript · First ${info.processedMinutes} minutes · Full file length unavailable`;
  }
  return `Partial transcript · First ${info.processedMinutes} of ${info.sourceMinutes} minutes`;
}
