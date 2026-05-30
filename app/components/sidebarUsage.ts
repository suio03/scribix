import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Session } from "next-auth";
import { quotaMinutesFor, type BillingCycle, type Tier } from "@/lib/plans";

export type SidebarUsage = {
  usedMin: number;
  quotaMin: number;
};

export async function getSidebarUsage(session: Session | null): Promise<SidebarUsage | undefined> {
  if (!session?.user?.id) return undefined;

  try {
    const { env } = getCloudflareContext();
    const row = await env.DB.prepare(
      `SELECT tier, billing_cycle, minutes_used_this_period
         FROM users
        WHERE id = ?1 AND deleted_at IS NULL`
    )
      .bind(session.user.id)
      .first<{
        tier: Tier;
        billing_cycle: BillingCycle | null;
        minutes_used_this_period: number;
      }>();

    if (!row) return undefined;

    return {
      usedMin: row.minutes_used_this_period,
      quotaMin: quotaMinutesFor(row.tier, row.billing_cycle),
    };
  } catch {
    return undefined;
  }
}
