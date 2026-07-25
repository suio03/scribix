import { isAllowedMedia } from "@/lib/media-upload";
import { ONE_GIB, PLANS, type Tier } from "@/lib/plans";

export type UploadPipeline = "extracted_audio" | "direct_video";
export type UploadFallbackReason =
  | "over_1gb"
  | "cannot_read_metadata"
  | "extraction_timeout"
  | "extraction_failed";

export type PreflightInput = {
  filename: string;
  bytes: number;
  mime: string;
  durationSec: number | null;
  isVideo: boolean;
};

export type PreflightRejection = {
  error:
    | "unsupported_media"
    | "invalid_duration"
    | "duration_exceeds_tier"
    | "file_too_large";
  maxBytes?: number;
  maxSec?: number;
  tier?: Tier;
  canUpgrade?: boolean;
  suggestedTier?: "pro";
  help?: "extract_audio";
};

export type PreflightDecision = {
  pipeline: UploadPipeline;
  fallbackReason?: UploadFallbackReason;
};

export function validateUploadPreflight(
  input: PreflightInput,
  tier: Tier
): PreflightRejection | PreflightDecision {
  if (!isAllowedMedia(input.filename, input.mime, input.isVideo)) {
    return { error: "unsupported_media" };
  }

  if (
    input.durationSec !== null &&
    (!Number.isFinite(input.durationSec) || input.durationSec <= 0)
  ) {
    return { error: "invalid_duration" };
  }

  const plan = PLANS[tier];
  if (input.durationSec !== null && input.durationSec > plan.maxFileSec) {
    const suggestedTier = tierForDuration(input.durationSec);
    return {
      error: "duration_exceeds_tier",
      maxSec: plan.maxFileSec,
      tier,
      canUpgrade: suggestedTier !== null && suggestedTier !== tier,
      suggestedTier: suggestedTier ?? undefined,
      help: suggestedTier ? undefined : "extract_audio",
    };
  }

  const sizeCap = input.isVideo ? plan.maxVideoUploadBytes : plan.maxFileBytes;
  if (input.bytes > sizeCap) {
    const suggestedTier = input.isVideo ? tierForVideoBytes(input.bytes) : null;
    return {
      error: "file_too_large",
      maxBytes: sizeCap,
      tier,
      canUpgrade: suggestedTier !== null && suggestedTier !== tier,
      suggestedTier: suggestedTier ?? undefined,
      help: "extract_audio",
    };
  }

  if (!input.isVideo) return { pipeline: "extracted_audio" };
  if (input.durationSec === null) {
    return { pipeline: "direct_video", fallbackReason: "cannot_read_metadata" };
  }
  if (input.bytes > ONE_GIB) {
    return { pipeline: "direct_video", fallbackReason: "over_1gb" };
  }
  return { pipeline: "extracted_audio" };
}

function tierForDuration(durationSec: number): "pro" | null {
  if (durationSec <= PLANS.pro.maxFileSec) return "pro";
  return null;
}

function tierForVideoBytes(bytes: number): "pro" | null {
  return bytes <= PLANS.pro.maxVideoUploadBytes ? "pro" : null;
}
