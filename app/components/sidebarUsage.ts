import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Session } from "next-auth";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { quotaMinutesFor } from "@/lib/plans";

export type SidebarUsage = {
  usedMin: number;
  quotaMin: number;
};

export async function getSidebarUsage(session: Session | null): Promise<SidebarUsage | undefined> {
  if (!session) return undefined;

  try {
    const { env } = getCloudflareContext();
    const user = await getOrCreateCurrentUser(env.DB, session);
    if (!user) return undefined;

    return {
      usedMin: user.minutes_used_this_period,
      quotaMin: quotaMinutesFor(user.tier, user.billing_cycle),
    };
  } catch {
    return undefined;
  }
}
