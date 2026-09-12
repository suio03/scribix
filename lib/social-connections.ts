import { PUBLISH_PLATFORMS } from "@/app/components/publishing/shared/specs";
import { validSocialOrigin } from "@/lib/social-origin";
import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { clipflightEnabled, clipflightRequest, socialStateHash } from "@/lib/clipflight";

type Params = { params: Promise<{ id: string }> };
export function createConnectionHandlers(projectScoped: boolean) {
async function context(params?: Params["params"]) {
  const session = await auth();
  if (!session) return null;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user || !clipflightEnabled(user.id)) return null;
  if (!projectScoped) return { env, user, projectId: null };
  const { id } = await params!;
  const project = await env.DB.prepare("SELECT id FROM video_projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL").bind(id, user.id).first();
  return project ? { env, user, projectId: id } : null;
}
async function GET(request: Request, { params }: Params = { params: Promise.resolve({ id: "" }) }) {
  const current = await context(params);
  if (!current) return Response.json({ error: "not_found" }, { status: 404 });
  const accountId = new URL(request.url).searchParams.get("creatorInfo");
  if (accountId) {
    if (accountId.length > 128) return Response.json({ error: "invalid_request" }, { status: 400 });
    const creator = await clipflightRequest(current.user.id, `/accounts/${encodeURIComponent(accountId)}/creator-info`);
    return creator.ok ? Response.json(await creator.json(), { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "social_service_unavailable" }, { status: 502 });
  }
  const response = await clipflightRequest(current.user.id, "/accounts");
  if (!response.ok) return Response.json({ error: "social_service_unavailable" }, { status: 502 });
  const data = await response.json() as { accounts: unknown[] };
  return Response.json({ accounts: data.accounts }, { headers: { "Cache-Control": "no-store" } });
}
async function POST(request: Request, { params }: Params = { params: Promise.resolve({ id: "" }) }) {
  if (!validSocialOrigin(request)) return Response.json({ error: "invalid_origin" }, { status: 403 });
  const current = await context(params);
  if (!current) return Response.json({ error: "not_found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { platform?: string; locale?: string; accountId?: string } | null;
  if (!PUBLISH_PLATFORMS.some(platform => platform === body?.platform) || !["en", "fr", "es", "it", "ja", "de"].includes(body?.locale ?? ""))
    return Response.json({ error: "invalid_request" }, { status: 400 });
  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
  const stateHash = await socialStateHash(state);
  const now = Math.floor(Date.now() / 1000);
  await current.env.DB.prepare("DELETE FROM social_connection_returns WHERE user_id = ? AND expires_at < ?").bind(current.user.id, now - 86400).run();
  await current.env.DB.prepare(`INSERT INTO social_connection_returns (state_hash, user_id, project_id, locale, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)`).bind(stateHash, current.user.id, current.projectId, body!.locale!, now, now + 600).run();
  const response = await clipflightRequest(current.user.id, "/connection-sessions", {
    method: "POST", body: JSON.stringify({ platform: body!.platform, returnState: state }),
  });
  if (!response.ok) return Response.json({ error: "social_service_unavailable" }, { status: 502 });
  const data = await response.json() as { id: string; connectionUrl: string };
  const destination = new URL(data.connectionUrl);
  if (destination.origin !== "https://app.clipflight.com" || destination.pathname !== "/connect")
    return Response.json({ error: "social_service_unavailable" }, { status: 502 });
  await current.env.DB.prepare("UPDATE social_connection_returns SET connection_session_id = ? WHERE state_hash = ? AND user_id = ?")
    .bind(data.id, stateHash, current.user.id).run();
  return Response.json({ connectionUrl: destination.href }, { headers: { "Cache-Control": "no-store" } });
}
async function DELETE(request: Request, { params }: Params = { params: Promise.resolve({ id: "" }) }) {
  if (!validSocialOrigin(request)) return Response.json({ error: "invalid_origin" }, { status: 403 });
  const current = await context(params);
  if (!current) return Response.json({ error: "not_found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { platform?: string; locale?: string; accountId?: string } | null;
  if (typeof body?.accountId !== "string" || body.accountId.length > 128) return Response.json({ error: "invalid_request" }, { status: 400 });
  const response = await clipflightRequest(current.user.id, `/accounts/${encodeURIComponent(body.accountId)}`, { method: "DELETE" });
  return Response.json(response.ok ? await response.json() : { error: response.status === 409 ? "social_account_busy" : "social_service_unavailable" }, { status: response.ok ? 200 : response.status === 409 ? 409 : 502 });
}

async function PATCH(request: Request, { params }: Params = { params: Promise.resolve({ id: "" }) }) {
  if (!validSocialOrigin(request)) return Response.json({ error: "invalid_origin" }, { status: 403 });
  const current = await context(params);
  if (!current) return Response.json({ error: "not_found" }, { status: 404 });
  const body = await request.json().catch(() => null) as {accountId?: unknown} | null;
  if (typeof body?.accountId !== "string" || !body.accountId || body.accountId.length > 128)
    return Response.json({ error: "invalid_request" }, { status: 400 });
  const response = await clipflightRequest(current.user.id, `/accounts/${encodeURIComponent(body.accountId)}/refresh`, { method: "POST" });
  return Response.json(response.ok ? await response.json() : { error: response.status === 409 ? "social_reconnect_required" : "social_service_unavailable" },
    { status: response.ok ? 200 : response.status === 409 ? 409 : 502, headers: { "Cache-Control": "no-store" } });
}
return { GET, POST, DELETE, PATCH };
}
