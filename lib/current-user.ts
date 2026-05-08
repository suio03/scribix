import type { Session } from "next-auth";
import type { BillingCycle, Tier } from "@/lib/plans";

export type CurrentUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  tier: Tier;
  billing_cycle: BillingCycle | null;
  subscription_status: string | null;
  customer_id: string | null;
  minutes_used_this_period: number;
  period_ends_at: string;
};

const CURRENT_USER_SELECT = `
  SELECT id, email, full_name, tier, billing_cycle, subscription_status,
         customer_id, minutes_used_this_period, period_ends_at
    FROM users
   WHERE deleted_at IS NULL
`;

export async function getOrCreateCurrentUser(
  db: D1Database,
  session: Session
): Promise<CurrentUserRow | null> {
  const id = session.user?.id?.trim();
  const email = session.user?.email?.trim();
  const name = session.user?.name?.trim() || null;
  const image = session.user?.image?.trim() || null;

  if (id) {
    const byId = await db
      .prepare(`${CURRENT_USER_SELECT} AND id = ?1`)
      .bind(id)
      .first<CurrentUserRow>();
    if (byId) return byId;
  }

  if (email) {
    const byEmail = await db
      .prepare(`${CURRENT_USER_SELECT} AND email = ?1`)
      .bind(email)
      .first<CurrentUserRow>();
    if (byEmail) return byEmail;
  }

  if (!id || !email) return null;

  await db
    .prepare(
      `INSERT INTO users (id, email, full_name, avatar_url, period_ends_at)
       VALUES (?1, ?2, ?3, ?4, '9999-12-31 00:00:00')
       ON CONFLICT(id) DO UPDATE SET
         email      = excluded.email,
         full_name  = excluded.full_name,
         avatar_url = excluded.avatar_url`
    )
    .bind(id, email, name, image)
    .run();

  return db
    .prepare(`${CURRENT_USER_SELECT} AND id = ?1`)
    .bind(id)
    .first<CurrentUserRow>();
}
