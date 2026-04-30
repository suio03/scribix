import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { createPortalLink } from "@/lib/creem";

export async function POST(req: Request) {
  void req;
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const env = cf();
  const user = await env.DB.prepare(
    `SELECT customer_id FROM users WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(userId)
    .first<{ customer_id: string | null }>();
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
