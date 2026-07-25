import { cf } from "@/lib/cf";
import { revokeExtensionSession } from "@/lib/extension-auth";
import { extensionJson, extensionOptions } from "@/lib/extension-api";

export function OPTIONS(req: Request) {
  return extensionOptions(req);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const env = await cf();
    await revokeExtensionSession(env.DB, body);
    return extensionJson(req, { revoked: true }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return extensionJson(req, { error: "invalid_json" }, { status: 400 });
    }
    throw error;
  }
}
