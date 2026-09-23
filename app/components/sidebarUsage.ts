import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Session } from "next-auth";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import {
  quotaMinutesFor,
  youtubeImportsFor,
  effectivePlanVersion,
  type BillingCycle,
  type Tier,
  type PlanVersion,
} from "@/lib/plans";

export type SidebarUsage = {
  tier: Tier;
  billingCycle: BillingCycle | null;
  planVersion: PlanVersion | null;
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
      planVersion: effectivePlanVersion(user.tier, user.plan_version, env.PADDLE_V2_CHECKOUT_ENABLED === "true"),
      subscriptionStatus: user.subscription_status,
      canManageBilling: Boolean(user.customer_id?.startsWith("ctm_")),
      usedMin: user.minutes_used_this_period,
      quotaMin: quotaMinutesFor(user.tier, user.billing_cycle, user.plan_version),
      usedYouTubeImports: user.youtube_imports_used_this_period,
      quotaYouTubeImports: youtubeImportsFor(user.tier, user.billing_cycle,
        effectivePlanVersion(user.tier, user.plan_version, env.PADDLE_V2_CHECKOUT_ENABLED === "true")),
    };
  } catch {
    return undefined;
  }
}
