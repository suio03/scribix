import type { Platform } from "./specs";

export type PublicAccount = {
  id: string;
  connectionId: string;
  connectionAccountCount: number;
  platformUserId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  status: "active" | "needs_reauth";
  canAutoRefresh?: boolean;
  expiresAt: number | null;
};

export type AccountProviderSummary = {
  platform: Platform;
  label: string;
  availability: "placeholder" | "ready";
  callbackPath: string;
  requiredConfig: string[];
  accounts: PublicAccount[];
};

export type AccountsResponse = {
  ok: true;
  providers: AccountProviderSummary[];
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram Reels",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};
