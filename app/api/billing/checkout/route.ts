import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { createCheckout } from "@/lib/creem";
import { productIdFor, type PaidTier } from "@/lib/creem-plans";
import type { BillingCycle, Tier } from "@/lib/plans";

const PAID: ReadonlyArray<PaidTier> = ["basic", "pro"];
const CYCLES: ReadonlyArray<BillingCycle> = ["monthly", "yearly"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  let body: { tier?: string; cycle?: string; successPath?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const tier = PAID.find((t) => t === body.tier);
  const cycle = CYCLES.find((c) => c === body.cycle);
  if (!tier || !cycle) {
    return Response.json({ error: "invalid_plan" }, { status: 400 });
  }

  const productId = productIdFor(tier, cycle);
  if (!productId) {
    return Response.json({ error: "product_not_configured" }, { status: 503 });
  }

  const env = cf();
  const user = await env.DB.prepare(
    `SELECT email, customer_id, tier, subscription_status
       FROM users WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(userId)
    .first<{
      email: string;
      customer_id: string | null;
      tier: Tier;
      subscription_status: string | null;
    }>();
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  if (user.tier !== "free" && user.subscription_status === "active") {
    return Response.json(
      {
        error: "already_subscribed",
        message: "You already have an active subscription. Use the customer portal to manage it.",
      },
      { status: 409 }
    );
  }

  const origin = new URL(req.url).origin;
  const successPath =
    typeof body.successPath === "string" && body.successPath.startsWith("/")
      ? body.successPath
      : "/dashboard";
  const successUrl = `${origin}${successPath}`;

  try {
    const url = await createCheckout({
      productId,
      successUrl,
      customer: {
        ...(user.customer_id ? { id: user.customer_id } : {}),
        ...(user.email ? { email: user.email } : {}),
      },
      metadata: { userId, tier, cycle },
    });
    return Response.json({ url });
  } catch (e) {
    return Response.json(
      { error: "checkout_failed", message: e instanceof Error ? e.message : "unknown" },
      { status: 502 }
    );
  }
}
