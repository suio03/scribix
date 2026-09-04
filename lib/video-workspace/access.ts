import type { Tier } from "../plans";

export type VideoWorkspaceAccess = {
  canEditClips: boolean;
  canUseBrandControls: boolean;
};

export function videoWorkspaceAccessFor(tier: Tier): VideoWorkspaceAccess {
  const paid = tier !== "free";
  return {
    canEditClips: paid,
    canUseBrandControls: paid,
  };
}
