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
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim() || "https://scribix.io";
  // The transaction's checkout.url is where Paddle returns the user after a
  // successful payment, and what Paddle.js uses as the overlay's success URL.
  const checkoutUrl = new URL(successPath, appUrl).toString();
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
      checkoutUrl,
      customerId: user.customer_id?.startsWith("ctm_") ? user.customer_id : null,
      userId: user.id,
      tier: plan.tier,
      cycle: plan.cycle,
    });
    return Response.json(checkout);
  } catch (error) {
    if (error instanceof PaddleApiError) {
      const details = paddleErrorDetails(error);
      console.error("create-checkout Paddle API error:", {
        status: error.status,
        code: details.code,
        detail: details.detail,
      });
      return Response.json(
        {
          error: "paddle_api_error",
          paddleStatus: error.status,
          paddleCode: details.code,
          paddleDetail: details.detail,
        },
        { status: error.status >= 400 && error.status < 500 ? 400 : 502 }
      );
    }
    console.error("create-checkout failed:", error);
    return Response.json({ error: "checkout_failed" }, { status: 502 });
  }
}

function isSafePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("://");
}

function paddleErrorDetails(error: PaddleApiError): {
  code: string | null;
  detail: string | null;
} {
  try {
    const parsed = JSON.parse(error.details) as {
      error?: { code?: string; detail?: string };
    };
    return {
      code: parsed.error?.code ?? null,
      detail: parsed.error?.detail ?? null,
    };
  } catch {
    return { code: null, detail: null };
  }
}
