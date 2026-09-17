import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { clipflightEnabled, clipflightRequest } from "@/lib/clipflight";
import { validSocialOrigin } from "@/lib/social-origin";
async function update(request: Request) {
  if (!validSocialOrigin(request)) return Response.json({error: "invalid_origin"}, {status: 403});
  const session = await auth();
  if (!session) return Response.json({error: "not_found"}, {status: 404});
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user || !clipflightEnabled(user.id)) return Response.json({error: "not_found"}, {status: 404});
  const body = await request.json().catch(() => null) as {postId?: string; scheduledAt?: number; timezone?: string} | null;
  if (typeof body?.postId !== "string" || body.postId.length > 128) return Response.json({error: "invalid_request"}, {status: 400});
  const row = await env.DB.prepare("SELECT id FROM social_submissions WHERE user_id = ? AND remote_post_id = ?").bind(user.id, body.postId).first<{id: string}>();
  if (!row) return Response.json({error: "not_found"}, {status: 404});
  const response = await clipflightRequest(user.id, `/posts/${encodeURIComponent(body.postId)}/schedule`, {
    method: request.method, ...(request.method === "PATCH" ? {body: JSON.stringify({scheduledAt: body.scheduledAt, timezone: body.timezone})} : {}),
  });
  if (!response.ok) return Response.json({error: "schedule_unavailable"}, {status: response.status >= 500 ? 502 : 409});
  // Both Posts and Planner read the same provider result on their next load.
  await env.DB.prepare("UPDATE social_submissions SET result_json = NULL WHERE id = ? AND user_id = ?").bind(row.id, user.id).run();
  return Response.json({ok: true});
}
export const PATCH = update;
export const DELETE = update;
