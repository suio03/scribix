import { cf } from "@/lib/cf";
import { discordAlert } from "@/lib/discord";
import { verifyPaddleSignature } from "@/lib/paddle";
import { findPaddlePlanByPriceId } from "@/lib/paddle-plans";
import { PLANS, type BillingCycle, type Tier } from "@/lib/plans";

type PaddleWebhookEvent = {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: PaddleTransaction | PaddleSubscription;
};

type PaddleTransaction = {
  id?: string;
  customer_id?: string | null;
  subscription_id?: string | null;
  custom_data?: PaddleCustomData | null;
  billing_period?: PaddlePeriod | null;
  items?: Array<{ price?: { id?: string } | null }> | null;
  details?: {
    line_items?: Array<{ price_id?: string; billing_period?: PaddlePeriod | null }> | null;
  } | null;
};

type PaddleSubscription = {
  id?: string;
  status?: string;
  customer_id?: string | null;
  custom_data?: PaddleCustomData | null;
  billing_cycle?: { interval?: string; frequency?: number } | null;
  current_billing_period?: PaddlePeriod | null;
  next_billed_at?: string | null;
  started_at?: string | null;
  first_billed_at?: string | null;
  canceled_at?: string | null;
  scheduled_change?: { action?: string; effective_at?: string | null } | null;
  items?: Array<{
    price?: { id?: string } | null;
    status?: string;
    next_billed_at?: string | null;
    previously_billed_at?: string | null;
  }> | null;
};

type PaddleCustomData = {
  userId?: string;
  tier?: Tier;
  cycle?: BillingCycle;
};

type PaddlePeriod = {
  starts_at?: string | null;
  ends_at?: string | null;
};

type UserBillingRow = {
  id: string;
  tier: Tier;
  billing_cycle: BillingCycle | null;
  customer_id: string | null;
  period_started_at: string;
  period_ends_at: string;
};

export async function POST(req: Request) {
  const env = await cf();
  const rawBody = await req.text();
  const secret = env.PADDLE_WEBHOOK_SECRET?.trim();
  const verified = await verifyPaddleSignature({
    rawBody,
    signatureHeader: req.headers.get("paddle-signature"),
    secret: secret ?? "",
  });
  if (!verified) return Response.json({ error: "invalid_signature" }, { status: 400 });

  let event: PaddleWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaddleWebhookEvent;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const eventId = event.event_id?.trim();
  const eventType = event.event_type?.trim();
  if (!eventId || !eventType) {
    return Response.json({ error: "missing_event_fields" }, { status: 400 });
  }

  const dedupe = await env.DB.prepare(
    `INSERT OR IGNORE INTO paddle_events (event_id, event_type)
     VALUES (?1, ?2)`
  )
    .bind(eventId, eventType)
    .run();
  if (!dedupe.meta?.changes) return Response.json({ ok: true, dedup: true });

  try {
    await processPaddleEvent(env, event);
    await env.DB.prepare(
      `UPDATE paddle_events SET processed_at = CURRENT_TIMESTAMP WHERE event_id = ?1`
    )
      .bind(eventId)
      .run();
    return Response.json({ ok: true });
  } catch (error) {
    await env.DB.prepare(`DELETE FROM paddle_events WHERE event_id = ?1`)
      .bind(eventId)
      .run();
    console.error("Paddle webhook failed:", error);
    await discordAlert("webhook_error", {
      source: "paddle",
      eventId,
      eventType,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "webhook_processing_failed" }, { status: 500 });
  }
}

async function processPaddleEvent(env: CloudflareEnv, event: PaddleWebhookEvent) {
  const type = event.event_type;
  if (!event.data) return;

  switch (type) {
    case "transaction.completed":
      await handleTransactionCompleted(env, event.data as PaddleTransaction, event.occurred_at);
      return;
    case "subscription.activated":
    case "subscription.updated":
      await handleSubscriptionActive(env, event.data as PaddleSubscription, event.occurred_at);
      return;
    case "subscription.canceled":
    case "subscription.paused":
      await handleSubscriptionEnded(env, event.data as PaddleSubscription, event.occurred_at);
      return;
    case "subscription.past_due":
      await handleSubscriptionPastDue(env, event.data as PaddleSubscription);
      return;
    default:
      return;
  }
}

async function handleTransactionCompleted(
  env: CloudflareEnv,
  transaction: PaddleTransaction,
  occurredAt?: string
) {
  const priceId = priceIdFromTransaction(transaction);
  const plan = findPaddlePlanByPriceId(env, priceId);
  if (!plan) {
    await discordAlert("webhook_error", {
      source: "paddle",
      reason: "unknown_price",
      priceId,
      transactionId: transaction.id,
    });
    throw new Error("unknown_paddle_price");
  }

  const userId = transaction.custom_data?.userId;
  if (!userId) throw new Error("missing_custom_user_id");
  const customerId = transaction.customer_id;
  if (!customerId?.startsWith("ctm_")) throw new Error("missing_customer_id");

  const period = periodFromTransaction(transaction, plan.cycle, occurredAt);
  await env.DB.prepare(
    `UPDATE users
        SET tier = ?1,
            billing_cycle = ?2,
            customer_id = ?3,
            product_id = ?4,
            subscription_status = 'active',
            minutes_used_this_period = 0,
            period_started_at = ?5,
            period_ends_at = ?6
      WHERE id = ?7
        AND deleted_at IS NULL`
  )
    .bind(plan.tier, plan.cycle, customerId, plan.priceId, period.startsAt, period.endsAt, userId)
    .run();

  await discordAlert("checkout_success", {
    userId,
    tier: plan.tier,
    cycle: plan.cycle,
    transactionId: transaction.id,
  });
}

async function handleSubscriptionActive(
  env: CloudflareEnv,
  subscription: PaddleSubscription,
  occurredAt?: string
) {
  const priceId = priceIdFromSubscription(subscription);
  const plan = findPaddlePlanByPriceId(env, priceId);
  if (!plan) {
    await discordAlert("webhook_error", {
      source: "paddle",
      reason: "unknown_price",
      priceId,
      subscriptionId: subscription.id,
    });
    throw new Error("unknown_paddle_price");
  }

  const user = await findBillingUser(env.DB, subscription.custom_data?.userId, subscription.customer_id);
  if (!user) throw new Error("user_not_found");

  const period = periodFromSubscription(subscription, plan.cycle, occurredAt);
  const incomingEnd = parseDateMs(period.endsAt);
  const existingEnd = parseDateMs(user.period_ends_at);
  const periodAdvanced = incomingEnd !== null && existingEnd !== null && incomingEnd > existingEnd;

  await env.DB.prepare(
    `UPDATE users
        SET tier = ?1,
            billing_cycle = ?2,
            customer_id = ?3,
            product_id = ?4,
            subscription_status = 'active',
            minutes_used_this_period = CASE WHEN ?5 THEN 0 ELSE minutes_used_this_period END,
            period_started_at = CASE WHEN ?5 THEN ?6 ELSE period_started_at END,
            period_ends_at = ?7
      WHERE id = ?8
        AND deleted_at IS NULL`
  )
    .bind(
      plan.tier,
      plan.cycle,
      subscription.customer_id ?? user.customer_id,
      plan.priceId,
      periodAdvanced ? 1 : 0,
      period.startsAt,
      period.endsAt,
      user.id
    )
    .run();
}

async function handleSubscriptionEnded(
  env: CloudflareEnv,
  subscription: PaddleSubscription,
  occurredAt?: string
) {
  const user = await findBillingUser(env.DB, subscription.custom_data?.userId, subscription.customer_id);
  if (!user) throw new Error("user_not_found");

  const priceId = priceIdFromSubscription(subscription);
  const plan =
    findPaddlePlanByPriceId(env, priceId) ??
    (user.tier === "free"
      ? null
      : { tier: user.tier, cycle: user.billing_cycle ?? "monthly", priceId: priceId ?? "" });
  const cycle = plan?.cycle ?? user.billing_cycle ?? "monthly";
  const period = periodFromSubscription(subscription, cycle, occurredAt);
  const accessEndsAt = period.endsAt || user.period_ends_at;

  if (isPastOrNow(accessEndsAt)) {
    await expireSubscription(env.DB, user.id, subscription.customer_id ?? user.customer_id);
    await discordAlert("subscription_expired", {
      userId: user.id,
      customerId: subscription.customer_id,
      subscriptionId: subscription.id,
    });
    return;
  }

  await env.DB.prepare(
    `UPDATE users
        SET subscription_status = 'canceled',
            customer_id = COALESCE(?1, customer_id),
            period_ends_at = ?2
      WHERE id = ?3
        AND deleted_at IS NULL`
  )
    .bind(subscription.customer_id, accessEndsAt, user.id)
    .run();

  await discordAlert("subscription_canceled", {
    userId: user.id,
    customerId: subscription.customer_id,
    subscriptionId: subscription.id,
  });
}

async function handleSubscriptionPastDue(env: CloudflareEnv, subscription: PaddleSubscription) {
  const user = await findBillingUser(env.DB, subscription.custom_data?.userId, subscription.customer_id);
  await discordAlert("payment_failed", {
    userId: user?.id,
    customerId: subscription.customer_id,
    subscriptionId: subscription.id,
  });
}

async function findBillingUser(
  db: D1Database,
  userId?: string | null,
  customerId?: string | null
): Promise<UserBillingRow | null> {
  if (userId) {
    const byId = await db
      .prepare(
        `SELECT id, tier, billing_cycle, customer_id, period_started_at, period_ends_at
           FROM users
          WHERE id = ?1 AND deleted_at IS NULL`
      )
      .bind(userId)
      .first<UserBillingRow>();
    if (byId) return byId;
  }
  if (customerId?.startsWith("ctm_")) {
    return db
      .prepare(
        `SELECT id, tier, billing_cycle, customer_id, period_started_at, period_ends_at
           FROM users
          WHERE customer_id = ?1 AND deleted_at IS NULL`
      )
      .bind(customerId)
      .first<UserBillingRow>();
  }
  return null;
}

async function expireSubscription(
  db: D1Database,
  userId: string,
  customerId: string | null | undefined
) {
  await db
    .prepare(
      `UPDATE users
          SET tier = 'free',
              billing_cycle = NULL,
              customer_id = COALESCE(?1, customer_id),
              product_id = NULL,
              subscription_status = 'expired',
              minutes_used_this_period = ?2,
              period_started_at = CURRENT_TIMESTAMP,
              period_ends_at = '9999-12-31 00:00:00'
        WHERE id = ?3
          AND deleted_at IS NULL`
    )
    .bind(customerId, PLANS.free.minutesPerCycle, userId)
    .run();
}

function priceIdFromTransaction(transaction: PaddleTransaction): string | null {
  return (
    transaction.items?.[0]?.price?.id ??
    transaction.details?.line_items?.[0]?.price_id ??
    null
  );
}

function priceIdFromSubscription(subscription: PaddleSubscription): string | null {
  const active = subscription.items?.find((item) => item.status === "active");
  return active?.price?.id ?? subscription.items?.[0]?.price?.id ?? null;
}

function periodFromTransaction(
  transaction: PaddleTransaction,
  cycle: BillingCycle,
  occurredAt?: string
) {
  const linePeriod = transaction.details?.line_items?.[0]?.billing_period;
  return normalizePeriod(transaction.billing_period ?? linePeriod, cycle, occurredAt);
}

function periodFromSubscription(
  subscription: PaddleSubscription,
  cycle: BillingCycle,
  occurredAt?: string
) {
  const item = subscription.items?.[0];
  const startsAt =
    subscription.current_billing_period?.starts_at ??
    item?.previously_billed_at ??
    subscription.first_billed_at ??
    subscription.started_at ??
    occurredAt ??
    new Date().toISOString();
  const endsAt =
    subscription.current_billing_period?.ends_at ??
    subscription.scheduled_change?.effective_at ??
    subscription.next_billed_at ??
    item?.next_billed_at ??
    null;

  return normalizePeriod({ starts_at: startsAt, ends_at: endsAt }, cycle, occurredAt);
}

function normalizePeriod(
  period: PaddlePeriod | null | undefined,
  cycle: BillingCycle,
  occurredAt?: string
) {
  const startsAt = toDateString(period?.starts_at ?? occurredAt ?? new Date().toISOString());
  const endsAt = toDateString(period?.ends_at ?? addCycle(startsAt, cycle).toISOString());
  return { startsAt, endsAt };
}

function addCycle(start: string, cycle: BillingCycle): Date {
  const date = new Date(start);
  if (cycle === "yearly") date.setUTCFullYear(date.getUTCFullYear() + 1);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date;
}

function toDateString(value: string): string {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function parseDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function isPastOrNow(value: string): boolean {
  const ms = parseDateMs(value);
  return ms !== null && ms <= Date.now();
}
