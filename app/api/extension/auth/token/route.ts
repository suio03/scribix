import { cf } from "@/lib/cf";
import {
  exchangeExtensionAuthorizationCode,
  ExtensionAuthError,
  refreshExtensionSession,
} from "@/lib/extension-auth";
import { extensionJson, extensionOptions } from "@/lib/extension-api";

export function OPTIONS(req: Request) {
  return extensionOptions(req);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const grantType =
      typeof body.grantType === "string" ? body.grantType.trim() : "";
    const env = await cf();
    const tokens =
      grantType === "authorization_code"
        ? await exchangeExtensionAuthorizationCode(env.DB, body)
        : grantType === "refresh_token"
          ? await refreshExtensionSession(env.DB, body)
          : null;
    if (!tokens) {
      return extensionJson(req, { error: "unsupported_grant_type" }, { status: 400 });
    }
    return extensionJson(req, tokens, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ExtensionAuthError) {
      return extensionJson(req, { error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return extensionJson(req, { error: "invalid_json" }, { status: 400 });
    }
    throw error;
  }
}
