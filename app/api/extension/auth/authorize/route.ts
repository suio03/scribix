import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import {
  createExtensionAuthorizationCode,
  ExtensionAuthError,
  parseExtensionAuthorizationRequest,
} from "@/lib/extension-auth";
import { appUrl } from "@/lib/extension-api";

export async function POST(req: Request) {
  if (req.headers.get("origin") !== appUrl()) {
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  }

  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const request = parseExtensionAuthorizationRequest(body);
    const env = await cf();
    const user = await getOrCreateCurrentUser(env.DB, session);
    if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

    const redirectUrl = await createExtensionAuthorizationCode(
      env.DB,
      user.id,
      request
    );
    return Response.json(
      { redirectUrl },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof ExtensionAuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }
    throw error;
  }
}
