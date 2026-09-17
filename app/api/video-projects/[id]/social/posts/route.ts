import { canUseSocialMedia, socialUpgradeRequired } from "@/lib/social-access";
import { MIN_SCHEDULE_DELAY_SECONDS, MAX_SCHEDULE_DELAY_SECONDS } from "@/lib/social-scheduling";
import { validSocialOrigin } from "@/lib/social-origin";
import { auth } from "@/auth";
import { cf, cfBackground } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { clipflightEnabled, clipflightRequest, socialSchedulingEnabled } from "@/lib/clipflight";
import { presignGet } from "@/lib/r2";
import { encryptSocialRequest, refreshSocialSubmission, socialRequestHash, type SocialSubmission } from "@/lib/social-submissions";
type Params = { params: Promise<{ id: string }> };
async function context(params: Params["params"]) {
  const session = await auth(); if (!session) return null;
  const env = await cf(); const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user || !clipflightEnabled(user.id)) return null;
  const { id } = await params;
  return await env.DB.prepare("SELECT id FROM video_projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL").bind(id, user.id).first() ? { env, user, id } : null;
}
export async function GET(_request: Request, { params }: Params) {
  const c = await context(params); if (!c) return Response.json({ error: "not_found" }, { status: 404 });
  if (!canUseSocialMedia(c.user.tier)) return socialUpgradeRequired();
  const rows = await c.env.DB.prepare("SELECT * FROM social_submissions WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT 10").bind(c.user.id, c.id).all<SocialSubmission>();
  const posts = [];
  for (const row of rows.results) posts.push(await refreshSocialSubmission(c.env.DB, row));
  return Response.json({ posts }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request, { params }: Params) {
  if (!validSocialOrigin(request)) return Response.json({ error: "invalid_origin" }, { status: 403 });
  const c = await context(params); if (!c) return Response.json({ error: "not_found" }, { status: 404 });
  if (!canUseSocialMedia(c.user.tier)) return socialUpgradeRequired();
  if (Number(request.headers.get("Content-Length")) > 32768) return Response.json({ error: "invalid_request" }, { status: 413 });
  const body = await request.json().catch(() => null) as { mode?: "now" | "schedule"; scheduledAt?: number; timezone?: string; batchId?: string; platform?: string; title?: string; submissionId: string; renderJobId: string; expectedRevision: number; confirmed: boolean; accountIds: string[]; caption: string; youtubeTitle?: string; youtube?: object; tiktok?: object[] } | null;
  if (!body || typeof body.submissionId !== "string" || !/^[a-f0-9-]{36}$/.test(body.submissionId) || typeof body.renderJobId !== "string" || !Number.isInteger(body.expectedRevision) || body.confirmed !== true)
    return Response.json({ error: "invalid_request" }, { status: 400 });
  if (body.batchId !== undefined && (!/^[a-f0-9-]{36}$/.test(body.batchId) || !["youtube", "linkedin"].includes(body.platform ?? "") || typeof body.title !== "string" || body.title.length > 500)) return Response.json({error: "invalid_request"}, {status: 400});
  const hash = await socialRequestHash(body);
  let saved = await c.env.DB.prepare("SELECT * FROM social_submissions WHERE id = ? AND user_id = ? AND project_id = ?").bind(body.submissionId, c.user.id, c.id).first<SocialSubmission & { request_hash: string }>();
  if (saved && saved.request_hash !== hash) return Response.json({ error: "submission_conflict" }, { status: 409 });
  if (!saved && body.mode !== undefined && body.mode !== "now" && body.mode !== "schedule") return Response.json({error: "invalid_request"}, {status: 400});
  if (!saved && body.mode === "schedule") {
    if (!await socialSchedulingEnabled(c.user.id)) return Response.json({error: "scheduling_unavailable"}, {status: 503});
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(body.scheduledAt) || body.scheduledAt! < now + MIN_SCHEDULE_DELAY_SECONDS || body.scheduledAt! > now + MAX_SCHEDULE_DELAY_SECONDS || typeof body.timezone !== "string") return Response.json({error: "invalid_schedule"}, {status: 400});
    try { new Intl.DateTimeFormat("en", {timeZone: body.timezone}); } catch { return Response.json({error: "invalid_schedule"}, {status: 400}); }
  }
  if (!saved) {
    const asset = await c.env.DB.prepare(`SELECT a.id, a.r2_key FROM render_jobs j
      JOIN project_versions v ON v.id = j.project_version_id AND v.user_id = j.user_id
      JOIN clip_candidates candidate ON candidate.id = v.candidate_id AND candidate.user_id = j.user_id
      JOIN media_assets a ON a.id = j.output_asset_id AND a.user_id = j.user_id
      WHERE j.id = ? AND j.project_id = ? AND j.user_id = ? AND j.kind = 'final' AND j.superseded_at IS NULL
        AND candidate.status <> 'deleted' AND candidate.draft_revision = ? AND candidate.draft_edl_json = v.edl_json
        AND json_remove(candidate.draft_render_spec_json, '$.coverTitle', '$.coverTimelineMs') = json_remove(v.render_spec_json, '$.coverTitle', '$.coverTimelineMs')
        AND a.social_hold_until >= 0 AND a.status = 'ready' AND a.deleted_at IS NULL AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)`)
      .bind(body.renderJobId, c.id, c.user.id, body.expectedRevision).first<{ id: string; r2_key: string }>();
    if (!asset) return Response.json({ error: "draft_conflict" }, { status: 409 });
    const head = await c.env.SCRIBIX_MEDIA.head(asset.r2_key);
    if (!head) return Response.json({ error: "render_asset_missing" }, { status: 410 });
    const now = Math.floor(Date.now() / 1000);
    const payload = { mode: body.mode ?? "now", scheduledAt: body.scheduledAt, timezone: body.timezone, accountIds: body.accountIds, caption: body.caption, youtubeTitle: body.youtubeTitle, youtube: body.youtube, tiktok: body.tiktok, confirmed: true,
      media: { url: await presignGet(asset.r2_key, 3600), sizeBytes: head.size, contentType: "video/mp4", expiresAt: now + 3600 } };
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE media_assets SET social_hold_until = MAX(social_hold_until, ?) WHERE id = ? AND user_id = ? AND social_hold_until >= 0 AND status = 'ready' AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)").bind(now + 3600, asset.id, c.user.id),
      c.env.DB.prepare(`INSERT INTO social_submissions (id, user_id, project_id, render_job_id, request_hash, request_encrypted, created_at, expires_at, batch_id, display_json)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM media_assets WHERE id = ? AND user_id = ? AND social_hold_until >= ? AND status = 'ready' AND deleted_at IS NULL
        ON CONFLICT(id) DO NOTHING`).bind(body.submissionId, c.user.id, c.id, body.renderJobId, hash, await encryptSocialRequest(payload), now, now + 3600, body.batchId ?? null, body.batchId ? JSON.stringify({platform: body.platform, title: body.title, caption: body.caption}) : null, asset.id, c.user.id, now + 3600),
    ]);
    saved = await c.env.DB.prepare("SELECT * FROM social_submissions WHERE id = ? AND user_id = ? AND project_id = ?").bind(body.submissionId, c.user.id, c.id).first<SocialSubmission & { request_hash: string }>();
  }
  if (!saved || saved.request_hash !== hash) return Response.json({ error: "submission_conflict" }, { status: 409 });
  // The progress page advances the persisted request; accepting it must not wait on a provider upload.
  if (body.batchId && !saved.remote_post_id && saved.request_encrypted) await cfBackground(() => refreshSocialSubmission(c.env.DB, saved!));
  const post = body.batchId ? {id: saved.remote_post_id ?? saved.id, status: "submitting"} : await refreshSocialSubmission(c.env.DB, saved);
  return Response.json({ post }, { status: 202, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, { params }: Params) {
  if (!validSocialOrigin(request)) return Response.json({ error: "invalid_origin" }, { status: 403 });
  const c = await context(params); if (!c) return Response.json({ error: "not_found" }, { status: 404 });
  if (!canUseSocialMedia(c.user.tier)) return socialUpgradeRequired();
  const body = await request.json().catch(() => null) as { postId?: string; targetId?: string } | null;
  if (!body || typeof body.postId !== "string" || typeof body.targetId !== "string" || body.targetId.length > 128) return Response.json({ error: "invalid_request" }, { status: 400 });
  const row = await c.env.DB.prepare("SELECT remote_post_id FROM social_submissions WHERE remote_post_id = ? AND user_id = ? AND project_id = ?").bind(body.postId, c.user.id, c.id).first<{ remote_post_id: string }>();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  const response = await clipflightRequest(c.user.id, `/posts/${encodeURIComponent(row.remote_post_id)}/retry`, { method: "POST", body: JSON.stringify({ targetId: body.targetId }) });
  return Response.json(response.ok ? { ok: true } : { error: "retry_unavailable" }, { status: response.ok ? 202 : 409 });
}
