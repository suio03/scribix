import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { createPaddleTransaction, paddleEnvironment, PaddleApiError } from "@/lib/paddle";
import { getPaddlePlan, isBillingCycle, isPaddlePaidTier } from "@/lib/paddle-plans";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { tier?: string; cycle?: string; successUrl?: string; successPath?: string };
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

  const env = withLocalPaddleEnv(await cf());
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim() || "https://scribix.io";
  const checkoutUrl = resolveCheckoutUrl({
    appUrl,
    environment: env.NEXT_PUBLIC_PADDLE_ENV,
    successUrl: body.successUrl,
    successPath: body.successPath,
  });
  if (!checkoutUrl) {
    return Response.json({ error: "invalid_success_url" }, { status: 400 });
  }
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

function withLocalPaddleEnv(env: CloudflareEnv): CloudflareEnv {
  if (process.env.NODE_ENV !== "development") return env;

  return {
    ...env,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_PADDLE_ENV: localPaddleEnvironment() ?? env.NEXT_PUBLIC_PADDLE_ENV,
    PADDLE_API_KEY: process.env.PADDLE_API_KEY ?? env.PADDLE_API_KEY,
    PADDLE_BASIC_MONTHLY_PRICE_ID:
      process.env.PADDLE_BASIC_MONTHLY_PRICE_ID ?? env.PADDLE_BASIC_MONTHLY_PRICE_ID,
    PADDLE_BASIC_YEARLY_PRICE_ID:
      process.env.PADDLE_BASIC_YEARLY_PRICE_ID ?? env.PADDLE_BASIC_YEARLY_PRICE_ID,
    PADDLE_PRO_MONTHLY_PRICE_ID:
      process.env.PADDLE_PRO_MONTHLY_PRICE_ID ?? env.PADDLE_PRO_MONTHLY_PRICE_ID,
    PADDLE_PRO_YEARLY_PRICE_ID:
      process.env.PADDLE_PRO_YEARLY_PRICE_ID ?? env.PADDLE_PRO_YEARLY_PRICE_ID,
  };
}

function localPaddleEnvironment(): CloudflareEnv["NEXT_PUBLIC_PADDLE_ENV"] | null {
  if (
    process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ||
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
  ) {
    return process.env.NEXT_PUBLIC_PADDLE_ENV;
  }
  return null;
}

function resolveCheckoutUrl({
  appUrl,
  environment,
  successUrl,
  successPath,
}: {
  appUrl: string;
  environment: string | undefined;
  successUrl?: string;
  successPath?: string;
}): string | null {
  if (successUrl) {
    return isAllowedCheckoutUrl(successUrl, appUrl, environment) ? successUrl : null;
  }

  const fallbackPath = successPath ?? "/pricing?checkout=ok";
  if (!isSafePath(fallbackPath)) return null;
  return new URL(fallbackPath, appUrl).toString();
}

function isAllowedCheckoutUrl(
  raw: string,
  appUrl: string,
  environment: string | undefined
): boolean {
  try {
    const url = new URL(raw);
    const app = new URL(appUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.host === app.host) return true;
    if (environment !== "production") {
      return url.hostname === "localhost" || url.hostname === "127.0.0.1";
    }
    return false;
  } catch {
    return false;
  }
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
