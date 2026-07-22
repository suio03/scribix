import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { transactionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.transactionId !== "string" || !body.transactionId.startsWith("txn_")) {
    return Response.json({ error: "invalid_transaction" }, { status: 400 });
  }
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const result = await env.DB.prepare(
    `UPDATE paddle_checkout_intents
        SET client_observed_at = CURRENT_TIMESTAMP
      WHERE transaction_id = ?1 AND user_id = ?2`
  )
    .bind(body.transactionId, user.id)
    .run();

  if (!result.meta?.changes) {
    return Response.json({ error: "checkout_intent_not_found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
