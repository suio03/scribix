import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { createPaddlePortalSession, paddleEnvironment, PaddleApiError } from "@/lib/paddle";

export async function POST() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const env = withLocalPaddleEnv(await cf());
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  if (!user.customer_id?.startsWith("ctm_")) {
    return Response.json({ error: "paddle_customer_required" }, { status: 400 });
  }

  const apiKey = env.PADDLE_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "paddle_not_configured" }, { status: 503 });
  }

  try {
    const portal = await createPaddlePortalSession({
      apiKey,
      environment: paddleEnvironment(env.NEXT_PUBLIC_PADDLE_ENV),
      customerId: user.customer_id,
    });
    return Response.json(portal);
  } catch (error) {
    console.error("create-portal failed:", error);
    if (error instanceof PaddleApiError) {
      const details = paddleErrorDetails(error);
      console.error("create-portal Paddle API error:", {
        status: error.status,
        code: details.code,
        detail: details.detail,
      });
      return Response.json(
        { error: "paddle_api_error" },
        { status: error.status >= 400 && error.status < 500 ? 400 : 502 }
      );
    }
    return Response.json({ error: "portal_failed" }, { status: 502 });
  }
}

function withLocalPaddleEnv(env: CloudflareEnv): CloudflareEnv {
  if (process.env.NODE_ENV !== "development") return env;

  return {
    ...env,
    NEXT_PUBLIC_PADDLE_ENV: localPaddleEnvironment() ?? env.NEXT_PUBLIC_PADDLE_ENV,
    PADDLE_API_KEY: process.env.PADDLE_API_KEY ?? env.PADDLE_API_KEY,
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
