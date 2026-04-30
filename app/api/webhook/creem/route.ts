// Creem webhook handler.
// - HMAC signature verified before any side effect.
// - Side effects run first; dedup row written only after they succeed so a
//   transient failure doesn't permanently swallow the retry.
// - Handlers are idempotent (absolute UPDATEs); a rare double-process on retry
//   re-applies the same state.
// - Quota counter resets on cycle events (checkout / renewal / expire).
// - Plan changes mid-cycle keep the counter; downgrades blocked.

import { cf } from "@/lib/cf";
import { verifyWebhookSignature } from "@/lib/creem";
import { findPlanByProductId, TIER_RANK, type CreemPlan } from "@/lib/creem-plans";
import { discordAlert } from "@/lib/discord";
import type { Tier } from "@/lib/plans";
import { parseDbDate } from "@/lib/quota";

type CreemCustomerObj = { id?: string; email?: string; country?: string };
type CreemProductObj = { id?: string };
type CreemOrderObj = { amount?: number; currency?: string };

type CreemEvent = {
  id?: string;
  eventType?: string;
  created_at?: string;
  object?: {
    id?: string;
    customer?: string | CreemCustomerObj;
    product?: string | CreemProductObj;
    metadata?: Record<string, string>;
    current_period_end_date?: string;
    current_period_start_date?: string;
    status?: string;
    order?: CreemOrderObj;
  };
};

export async function POST(req: Request) {
  const env = cf();
  const raw = await req.text();
  const signature = req.headers.get("creem-signature") ?? "";

  if (!(await verifyWebhookSignature(raw, signature))) {
    await discordAlert("webhook_error", { reason: "invalid_signature" });
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  let event: CreemEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const eventId = event.id ?? `${event.eventType ?? ""}-${event.object?.id ?? ""}-${event.created_at ?? ""}`;
  if (!eventId.trim()) {
    // Unidentifiable event — accept silently so Creem doesn't retry.
    return Response.json({ ok: true });
  }

  // Cheap upfront dedup check. The authoritative INSERT happens after side
  // effects succeed, so a transient failure mid-handler can be retried.
  const seen = await env.DB.prepare(
    `SELECT 1 FROM processed_creem_events WHERE event_id = ?1`
  )
    .bind(eventId)
    .first();
  if (seen) {
    return Response.json({ ok: true, dedup: true });
  }

  const obj = event.object ?? {};
  const customer = typeof obj.customer === "object" ? (obj.customer as CreemCustomerObj) : null;
  const product = typeof obj.product === "object" ? (obj.product as CreemProductObj) : null;
  const customerId =
    customer?.id ?? (typeof obj.customer === "string" ? obj.customer : "");
  const productId =
    product?.id ?? (typeof obj.product === "string" ? obj.product : "");
  const customerEmail = customer?.email ?? "";
  const metadataUserId = obj.metadata?.userId ?? "";
  const periodEnd = obj.current_period_end_date ?? null;

  try {
    switch (event.eventType) {
      case "checkout.completed": {
        const plan = findPlanByProductId(productId);
        if (!plan || !customerId) {
          await discordAlert("webhook_error", {
            event: event.eventType,
            reason: "missing_plan_or_customer",
            productId,
            customerId,
          });
          break;
        }

        const userId =
          metadataUserId ||
          (await findUserId(env.DB, { customerId, email: customerEmail }));
        if (!userId) {
          await discordAlert("webhook_error", {
            event: event.eventType,
            reason: "user_not_found",
            customerId,
            email: customerEmail,
          });
          break;
        }

        await env.DB.prepare(
          `UPDATE users
              SET tier = ?2,
                  billing_cycle = ?3,
                  customer_id = ?4,
                  product_id = ?5,
                  subscription_status = 'active',
                  minutes_used_this_period = 0,
                  period_started_at = CURRENT_TIMESTAMP,
                  period_ends_at = ?6
            WHERE id = ?1 AND deleted_at IS NULL`
        )
          .bind(
            userId,
            plan.tier,
            plan.cycle,
            customerId,
            productId,
            periodEnd ?? defaultPeriodEnd(plan.cycle)
          )
          .run();

        await discordAlert("checkout_success", {
          tier: plan.tier,
          cycle: plan.cycle,
          email: customerEmail,
          amount: formatAmount(obj.order),
          country: customer?.country,
        });
        break;
      }

      case "subscription.paid":
      case "subscription.updated":
      case "subscription.active": {
        const plan = findPlanByProductId(productId);
        if (!plan || !customerId) {
          await discordAlert("webhook_error", {
            event: event.eventType,
            reason: "missing_plan_or_customer",
            productId,
            customerId,
          });
          break;
        }

        const userRow = await env.DB.prepare(
          `SELECT id, tier, period_ends_at
             FROM users WHERE customer_id = ?1 AND deleted_at IS NULL`
        )
          .bind(customerId)
          .first<{ id: string; tier: Tier; period_ends_at: string | null }>();
        if (!userRow) {
          // Most likely racing with checkout.completed on first payment — Creem
          // will retry if we 5xx, so just acknowledge and move on.
          break;
        }

        if (TIER_RANK[plan.tier] < TIER_RANK[userRow.tier]) {
          await discordAlert("downgrade_blocked", {
            user: userRow.id,
            from: userRow.tier,
            to: plan.tier,
            event: event.eventType,
          });
          break;
        }

        if (isRenewal(userRow.period_ends_at, periodEnd)) {
          await env.DB.prepare(
            `UPDATE users
                SET tier = ?2,
                    billing_cycle = ?3,
                    product_id = ?4,
                    subscription_status = 'active',
                    minutes_used_this_period = 0,
                    period_started_at = CURRENT_TIMESTAMP,
                    period_ends_at = ?5
              WHERE id = ?1`
          )
            .bind(
              userRow.id,
              plan.tier,
              plan.cycle,
              productId,
              periodEnd ?? defaultPeriodEnd(plan.cycle)
            )
            .run();
        } else {
          // Plan change mid-cycle — keep the counter, raise caps to new tier.
          await env.DB.prepare(
            `UPDATE users
                SET tier = ?2,
                    billing_cycle = ?3,
                    product_id = ?4,
                    subscription_status = 'active'
              WHERE id = ?1`
          )
            .bind(userRow.id, plan.tier, plan.cycle, productId)
            .run();
        }
        break;
      }

      case "subscription.canceled": {
        if (!customerId) break;
        await env.DB.prepare(
          `UPDATE users
              SET subscription_status = 'canceled'
            WHERE customer_id = ?1 AND deleted_at IS NULL`
        )
          .bind(customerId)
          .run();
        await discordAlert("subscription_canceled", { customerId, email: customerEmail });
        break;
      }

      case "subscription.expired": {
        if (!customerId) break;
        await env.DB.prepare(
          `UPDATE users
              SET tier = 'free',
                  billing_cycle = NULL,
                  product_id = NULL,
                  subscription_status = 'expired',
                  minutes_used_this_period = 0,
                  period_started_at = CURRENT_TIMESTAMP,
                  period_ends_at = datetime('now', '+30 days')
            WHERE customer_id = ?1 AND deleted_at IS NULL`
        )
          .bind(customerId)
          .run();
        await discordAlert("subscription_expired", { customerId, email: customerEmail });
        break;
      }

      case "payment.failed":
      case "subscription.past_due": {
        await discordAlert("payment_failed", {
          event: event.eventType,
          customerId,
          email: customerEmail,
        });
        break;
      }

      default:
        break;
    }
  } catch (e) {
    await discordAlert("webhook_error", {
      event: event.eventType,
      error: e instanceof Error ? e.message : String(e),
    });
    return Response.json({ error: "handler_failed" }, { status: 500 });
  }

  // Mark processed only after side effects succeeded. Conflict here means a
  // concurrent retry won the race — its handler ran the same idempotent UPDATE,
  // so still 200.
  try {
    await env.DB.prepare(`INSERT INTO processed_creem_events (event_id) VALUES (?1)`)
      .bind(eventId)
      .run();
  } catch {
    // ignore UNIQUE conflict from concurrent retry
  }

  return Response.json({ ok: true });
}

function isRenewal(stored: string | null, incoming: string | null): boolean {
  if (!incoming) return false;
  if (!stored) return true;
  return parseDbDate(stored).getTime() < new Date(incoming).getTime();
}

function defaultPeriodEnd(cycle: CreemPlan["cycle"]): string {
  const days = cycle === "yearly" ? 366 : 31;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function formatAmount(order: CreemOrderObj | undefined): string {
  if (!order || order.amount == null) return "—";
  return `${(order.amount / 100).toFixed(2)} ${order.currency ?? ""}`.trim();
}

async function findUserId(
  db: D1Database,
  { customerId, email }: { customerId: string; email: string }
): Promise<string | null> {
  if (customerId) {
    const r = await db
      .prepare(`SELECT id FROM users WHERE customer_id = ?1 AND deleted_at IS NULL`)
      .bind(customerId)
      .first<{ id: string }>();
    if (r) return r.id;
  }
  if (email) {
    const r = await db
      .prepare(`SELECT id FROM users WHERE email = ?1 AND deleted_at IS NULL`)
      .bind(email)
      .first<{ id: string }>();
    if (r) return r.id;
  }
  return null;
}
