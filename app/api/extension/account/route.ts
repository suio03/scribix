import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { appUrl, extensionJson, extensionOptions } from "@/lib/extension-api";
import { getOrCreateCurrentUser } from "@/lib/current-user";

export function OPTIONS(req: Request) {
  return extensionOptions(req);
}

export async function GET(req: Request) {
  const session = await auth();
  const baseUrl = appUrl();
  if (!session) {
    return extensionJson(req, {
      signedIn: false,
      paid: false,
      signInUrl: `${baseUrl}/extension-login?callbackUrl=${encodeURIComponent("/")}`,
      upgradeUrl: `${baseUrl}/pricing`,
    });
  }

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) {
    return extensionJson(req, { signedIn: false, paid: false, upgradeUrl: `${baseUrl}/pricing` });
  }

  return extensionJson(req, {
    signedIn: true,
    email: user.email,
    tier: user.tier,
    paid: user.tier !== "free",
    signInUrl: `${baseUrl}/extension-login?callbackUrl=${encodeURIComponent("/")}`,
    upgradeUrl: `${baseUrl}/pricing`,
  });
}
