import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import {
  authenticateExtensionRequest,
  hasAuthorizationHeader,
} from "@/lib/extension-auth";
import {
  appUrl,
  extensionJson,
  extensionOptions,
  isLegacyChromeExtensionOrigin,
} from "@/lib/extension-api";
import { getOrCreateCurrentUser } from "@/lib/current-user";

export function OPTIONS(req: Request) {
  return extensionOptions(req);
}

export async function GET(req: Request) {
  const baseUrl = appUrl();
  const env = await cf();
  const accessUser = await authenticateExtensionRequest(env.DB, req);
  if (accessUser) {
    return extensionJson(req, {
      signedIn: true,
      email: accessUser.email,
      avatarUrl: accessUser.avatar_url,
      tier: accessUser.tier,
      paid: accessUser.tier !== "free",
      signInUrl: `${baseUrl}/extension-login`,
      upgradeUrl: `${baseUrl}/pricing`,
    });
  }
  if (hasAuthorizationHeader(req)) {
    return extensionJson(req, { error: "unauthorized" }, { status: 401 });
  }

  if (!isLegacyChromeExtensionOrigin(req)) {
    return extensionJson(req, {
      signedIn: false,
      paid: false,
      signInUrl: `${baseUrl}/extension-login`,
      upgradeUrl: `${baseUrl}/pricing`,
    });
  }

  const session = await auth();
  if (!session) {
    return extensionJson(req, {
      signedIn: false,
      paid: false,
      signInUrl: `${baseUrl}/extension-login`,
      upgradeUrl: `${baseUrl}/pricing`,
    });
  }

  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) {
    return extensionJson(req, { signedIn: false, paid: false, upgradeUrl: `${baseUrl}/pricing` });
  }

  return extensionJson(req, {
    signedIn: true,
    email: user.email,
    avatarUrl: session.user.image ?? user.avatar_url,
    tier: user.tier,
    paid: user.tier !== "free",
    signInUrl: `${baseUrl}/extension-login`,
    upgradeUrl: `${baseUrl}/pricing`,
  });
}
