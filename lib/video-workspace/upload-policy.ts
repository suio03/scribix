import type { Tier } from "../plans";
import type { UploadWorkflow } from "../upload-preflight";

export function resolveUploadWorkflow(
  requested: UploadWorkflow | undefined,
  isVideo: boolean
): UploadWorkflow {
  return isVideo ? "video_clips" : requested ?? "transcript";
}

export function videoSourceStorageUpgradeFor(tier: Tier): {
  canUpgrade: boolean;
  suggestedTier?: "pro";
} {
  return tier === "pro"
    ? { canUpgrade: false }
    : { canUpgrade: true, suggestedTier: "pro" };
}
