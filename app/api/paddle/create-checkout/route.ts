import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { createPaddleTransaction, paddleEnvironment, PaddleApiError } from "@/lib/paddle";
import { getPaddlePlan, isBillingCycle, isPaddlePaidTier } from "@/lib/paddle-plans";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { tier?: string; cycle?: string; successPath?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const tier = body.tier ?? "";
  const cycle = body.cycle ?? "";
  if (!isPaddlePaidTier(tier) || !isBillingCycle(cycle)) {
    return Response.json({ error: "invalid_plan" }, { status: 400 });
  }

  const successPath = body.successPath ?? "/dashboard?checkout=ok";
  if (!isSafePath(successPath)) {
    return Response.json({ error: "invalid_success_path" }, { status: 400 });
  }

  const env = await cf();
  const plan = getPaddlePlan(env, tier, cycle);
  if (!plan) {
    return Response.json({ error: "paddle_price_not_configured" }, { status: 503 });
  }

  const apiKey = env.PADDLE_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "paddle_not_configured" }, { status: 503 });
  }

  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  try {
    const checkout = await createPaddleTransaction({
      apiKey,
      environment: paddleEnvironment(env.NEXT_PUBLIC_PADDLE_ENV),
      priceId: plan.priceId,
      customerId: user.customer_id?.startsWith("ctm_") ? user.customer_id : null,
      userId: user.id,
      tier: plan.tier,
      cycle: plan.cycle,
    });
    return Response.json(checkout);
  } catch (error) {
    console.error("create-checkout failed:", error);
    if (error instanceof PaddleApiError) {
      return Response.json(
        { error: "paddle_api_error" },
        { status: error.status >= 400 && error.status < 500 ? 400 : 502 }
      );
    }
    return Response.json({ error: "checkout_failed" }, { status: 502 });
  }
}

function isSafePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("://");
}
