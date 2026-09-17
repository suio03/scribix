import type { Tier } from "@/lib/plans";

// Basic remains a paid entitlement for grandfathered subscribers.
export function canUseSocialMedia(tier: Tier | undefined): boolean {
  return tier === "basic" || tier === "pro";
}

export function socialUpgradeRequired() {
  return Response.json({ error: "upgrade_required" }, { status: 402, headers: { "Cache-Control": "no-store" } });
}
