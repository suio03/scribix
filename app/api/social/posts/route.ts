import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { clipflightEnabled, clipflightRequest } from "@/lib/clipflight";
import { validSocialOrigin } from "@/lib/social-origin";
import { refreshSocialSubmission, type SocialSubmission } from "@/lib/social-submissions";
async function context() {
  const session = await auth(); if (!session) return null;
  const env = await cf(); const user = await getOrCreateCurrentUser(env.DB, session);
  return user && clipflightEnabled(user.id) ? {env, user} : null;
}
export async function GET(request: Request) {
  const c = await context(); if (!c) return Response.json({error: "not_found"}, {status: 404});
  const planner = new URL(request.url).searchParams.get("planner") === "1";
  const task = new URL(request.url).searchParams.get("task");
  const rows = await c.env.DB.prepare(`SELECT s.*, t.title AS project_title FROM social_submissions s
    LEFT JOIN video_projects p ON p.id = s.project_id AND p.user_id = s.user_id
    LEFT JOIN transcripts t ON t.id = p.transcript_id AND t.user_id = s.user_id
    WHERE s.user_id = ? AND (? IS NULL OR s.batch_id = ?) ORDER BY s.created_at DESC LIMIT ?`).bind(c.user.id, task, task, planner ? 500 : 30).all<SocialSubmission & {batch_id: string | null; display_json: string | null; created_at: number; render_job_id: string; project_title: string | null}>();
  let refreshed = 0;
  const posts = [];
  for (const row of rows.results) {
    const display = row.display_json ? JSON.parse(row.display_json) : null;
    const cached = row.result_json ? JSON.parse(row.result_json) : null;
    const terminal = cached && ["published", "partial", "failed", "canceled"].includes(cached.status);
    const futureSchedule = cached?.status === "scheduled" && cached.scheduledAt > Date.now() / 1000 + 60;
    const result = !terminal && !futureSchedule && refreshed++ < 10 ? await refreshSocialSubmission(c.env.DB, row) : cached;
    posts.push({id: row.remote_post_id ?? row.id, mediaId: row.render_job_id, status: "submitting", createdAt: row.created_at,
      ...result, batchId: row.batch_id, submissionId: row.id, media: {width: null, height: null, ...result?.media, filename: display?.title ?? row.project_title ?? result?.media?.filename}, caption: display?.caption ?? result?.caption ?? "", targets: result?.targets?.length ? result.targets : display ? [{id: row.id, platform: display.platform, status: result?.status ?? "submitting", accountName: display.platform === "youtube" ? "YouTube" : "LinkedIn", errorCode: result?.errorCode}] : []});
  }
  return Response.json({posts}, {headers: {"Cache-Control": "no-store"}});
}
export async function PATCH(request: Request) {
  if (!validSocialOrigin(request)) return Response.json({error: "invalid_origin"}, {status: 403});
  const c = await context(); if (!c) return Response.json({error: "not_found"}, {status: 404});
  const body = await request.json().catch(() => null) as {postId?: string; targetId?: string} | null;
  if (typeof body?.postId !== "string" || typeof body?.targetId !== "string" || body.targetId.length > 128) return Response.json({error: "invalid_request"}, {status: 400});
  const row = await c.env.DB.prepare("SELECT id, remote_post_id FROM social_submissions WHERE user_id = ? AND remote_post_id = ?").bind(c.user.id, body.postId).first<{id: string; remote_post_id: string}>();
  if (!row) return Response.json({error: "not_found"}, {status: 404});
  const response = await clipflightRequest(c.user.id, `/posts/${encodeURIComponent(row.remote_post_id)}/retry`, {method: "POST", body: JSON.stringify({targetId: body.targetId})});
  if (response.ok) await c.env.DB.prepare("UPDATE social_submissions SET result_json = NULL WHERE id = ? AND user_id = ?").bind(row.id, c.user.id).run();
  return Response.json(response.ok ? {ok: true} : {error: "retry_unavailable"}, {status: response.ok ? 202 : 409});
}
