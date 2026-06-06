import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { createPaddlePortalSession, paddleEnvironment, PaddleApiError } from "@/lib/paddle";

export async function POST() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const env = await cf();
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
      return Response.json(
        { error: "paddle_api_error" },
        { status: error.status >= 400 && error.status < 500 ? 400 : 502 }
      );
    }
    return Response.json({ error: "portal_failed" }, { status: 502 });
  }
}
