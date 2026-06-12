import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Session } from "next-auth";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import {
  quotaMinutesFor,
  youtubeImportsFor,
  type BillingCycle,
  type Tier,
} from "@/lib/plans";

export type SidebarUsage = {
  tier: Tier;
  billingCycle: BillingCycle | null;
  subscriptionStatus: string | null;
  canManageBilling: boolean;
  usedMin: number;
  quotaMin: number;
  usedYouTubeImports: number;
  quotaYouTubeImports: number;
};

export async function getSidebarUsage(session: Session | null): Promise<SidebarUsage | undefined> {
  if (!session) return undefined;

  try {
    const { env } = getCloudflareContext();
    const user = await getOrCreateCurrentUser(env.DB, session);
    if (!user) return undefined;

    return {
      tier: user.tier,
      billingCycle: user.billing_cycle,
      subscriptionStatus: user.subscription_status,
      canManageBilling: Boolean(user.customer_id?.startsWith("ctm_")),
      usedMin: user.minutes_used_this_period,
      quotaMin: quotaMinutesFor(user.tier, user.billing_cycle),
      usedYouTubeImports: user.youtube_imports_used_this_period,
      quotaYouTubeImports: youtubeImportsFor(user.tier, user.billing_cycle),
    };
  } catch {
    return undefined;
  }
}
