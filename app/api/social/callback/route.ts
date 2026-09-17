import { canUseSocialMedia, socialUpgradeRequired } from "@/lib/social-access";
import { socialOrigin } from "@/lib/social-origin";
import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { clipflightRequest, socialStateHash } from "@/lib/clipflight";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (user && !canUseSocialMedia(user.tier)) return socialUpgradeRequired();
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const id = url.searchParams.get("connectionSessionId");
  if (!user || !state || !/^[a-f0-9]{64}$/.test(state) || !id || id.length > 128) return Response.json({ error: "invalid_connection_return" }, { status: 400 });
  const stateHash = await socialStateHash(state);
  const record = await env.DB.prepare(`UPDATE social_connection_returns SET status = 'checking'
    WHERE state_hash = ? AND user_id = ? AND connection_session_id = ? AND status = 'pending' AND expires_at > ?
    RETURNING project_id, locale`).bind(stateHash, user.id, id, Math.floor(Date.now() / 1000)).first<{ project_id: string | null; locale: string }>();
  if (!record) return Response.json({ error: "connection_return_expired" }, { status: 410 });
  const response = await clipflightRequest(user.id, `/connection-sessions/${encodeURIComponent(id)}`);
  const result = response.ok ? await response.json() as { session?: { status: string } } : null;
  const status = result?.session?.status === "connected" ? "connected" : "failed";
  await env.DB.prepare("UPDATE social_connection_returns SET status = ? WHERE state_hash = ? AND user_id = ?").bind(status, stateHash, user.id).run();
  const returnPath = record.project_id ? `/dashboard/video-projects/${encodeURIComponent(record.project_id)}` : "/dashboard/accounts";
  const destination = new URL(`${record.locale === "en" ? "" : `/${record.locale}`}${returnPath}`, socialOrigin(request));
  destination.searchParams.set("socialConnection", status);
  return new Response(null, { status: 303, headers: { Location: destination.href, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
