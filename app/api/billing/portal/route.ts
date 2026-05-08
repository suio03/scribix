import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { createPortalLink } from "@/lib/creem";

export async function POST(req: Request) {
  void req;
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const env = cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user?.customer_id) {
    return Response.json(
      { error: "no_customer", message: "Subscribe first to access billing." },
      { status: 400 }
    );
  }

  try {
    const url = await createPortalLink(user.customer_id);
    return Response.json({ url });
  } catch (e) {
    return Response.json(
      { error: "portal_failed", message: e instanceof Error ? e.message : "unknown" },
      { status: 502 }
    );
  }
}
