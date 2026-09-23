import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import type { Tier } from "@/lib/plans";

export type UpgradeContext = {
  signedIn: boolean;
  tier: Tier;
  checkoutEnabled: boolean;
};

// Runtime plan context for the in-app upgrade modal; the checkout flag is a
// Worker variable, so client bundles cannot read it at build time.
export async function GET() {
  const env = await cf();
  const checkoutEnabled = env.PADDLE_V2_CHECKOUT_ENABLED === "true";
  const session = await auth();
  const user = session ? await getOrCreateCurrentUser(env.DB, session) : null;
  const body: UpgradeContext = {
    signedIn: Boolean(session),
    tier: user?.tier ?? "free",
    checkoutEnabled,
  };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
