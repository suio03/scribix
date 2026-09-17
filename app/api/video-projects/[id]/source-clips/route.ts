import {auth} from "@/auth";
import {cf} from "@/lib/cf";
import {getOrCreateCurrentUser} from "@/lib/current-user";
import {validSocialOrigin} from "@/lib/social-origin";
import {videoWorkspaceAccessFor} from "@/lib/video-workspace/access";
import {VIDEO_WORKSPACE_LIMITS} from "@/lib/video-workspace/contracts";
import {listClipCandidates} from "@/lib/video-workspace/candidates";
import type {AaiTranscript} from "@/lib/aai";

type Params = {params: Promise<{id: string}>};
async function context(params: Params["params"]) {
  const session = await auth(); if (!session) return null;
  const env = await cf(); const user = await getOrCreateCurrentUser(env.DB, session); if (!user) return null;
  const {id} = await params;
  const source = await env.DB.prepare(`SELECT a.r2_key, a.duration_ms, t.transcript_r2_key, t.status AS transcript_status
    FROM video_projects p JOIN media_assets a ON a.id=p.source_asset_id AND a.user_id=p.user_id
    JOIN transcripts t ON t.id=p.transcript_id AND t.user_id=p.user_id
    WHERE p.id=? AND p.user_id=? AND p.deleted_at IS NULL AND t.deleted_at IS NULL
      AND a.deleted_at IS NULL AND a.status='ready' AND a.duration_ms>0 AND (a.expires_at IS NULL OR a.expires_at>CURRENT_TIMESTAMP)`)
    .bind(id,user.id).first<{r2_key: string; duration_ms: number; transcript_r2_key: string | null; transcript_status: string}>();
  return source ? {env,user,id,source} : null;
}
export async function GET(_request: Request, {params}: Params) {
  const c = await context(params); if (!c) return Response.json({error:"source_unavailable"},{status:404});
  if (c.source.transcript_status === "error") return Response.json({error:"transcript_failed"},{status:422});
  if (c.source.transcript_status !== "completed" || !c.source.transcript_r2_key) return Response.json({error:"transcript_not_ready"},{status:409});
  const [head, object] = await Promise.all([c.env.SCRIBIX_MEDIA.head(c.source.r2_key), c.env.SCRIBIX_MEDIA.get(c.source.transcript_r2_key)]);
  if (!head || !object) return Response.json({error:"source_unavailable"},{status:410});
  const transcript = await object.json<AaiTranscript>();
  return Response.json({url: `/api/video-projects/${encodeURIComponent(c.id)}/source?format=media`, durationMs:c.source.duration_ms,
    words:(transcript.words ?? []).filter(word => Number.isFinite(word.start) && Number.isFinite(word.end) && word.end>word.start).map(word => ({text:word.text,start:word.start,end:word.end}))}, {headers:{"Cache-Control":"no-store"}});
}
export async function POST(request: Request,{params}: Params) {
  if (!validSocialOrigin(request)) return Response.json({error:"invalid_origin"},{status:403});
  const c = await context(params); if (!c) return Response.json({error:"source_unavailable"},{status:404});
  if (!videoWorkspaceAccessFor(c.user.tier).canEditClips) return Response.json({error:"upgrade_required"},{status:402});
  if (c.source.transcript_status !== "completed") return Response.json({error:"transcript_not_ready"},{status:409});
  const body = await request.json().catch(()=>null) as {requestId?: string; startMs?: number; endMs?: number} | null;
  if (!body || typeof body.requestId!=="string" || !/^[a-f0-9-]{36}$/.test(body.requestId) || !Number.isInteger(body.startMs) || !Number.isInteger(body.endMs) || body.startMs!<0 || body.endMs!>c.source.duration_ms || body.endMs!-body.startMs!<250 || body.endMs!-body.startMs!>VIDEO_WORKSPACE_LIMITS.maxTimelineDurationMs) return Response.json({error:"invalid_range"},{status:400});
  if (!await c.env.SCRIBIX_MEDIA.head(c.source.r2_key)) return Response.json({error:"source_unavailable"},{status:410});
  const segments=JSON.stringify([{startMs:body.startMs,endMs:body.endMs}]);
  // An immutable request ID is also the candidate ID, making reloads/retries safe.
  await c.env.DB.prepare(`INSERT INTO clip_candidates(id,user_id,project_id,rank,theme,hook,reason,score,segments_json,status,origin)
    SELECT ?,?,?,COALESCE(MAX(rank),-1)+1,'manual_source','manual_source','manual_source',0,?,'accepted','manual'
    FROM clip_candidates WHERE project_id=? AND user_id=? ON CONFLICT(id) DO NOTHING`)
    .bind(body.requestId,c.user.id,c.id,segments,c.id,c.user.id).run();
  const saved=await c.env.DB.prepare("SELECT segments_json,status FROM clip_candidates WHERE id=? AND project_id=? AND user_id=?")
    .bind(body.requestId,c.id,c.user.id).first<{segments_json:string;status:string}>();
  if (!saved || saved.segments_json!==segments || saved.status==="deleted") return Response.json({error:"request_conflict"},{status:409});
  return Response.json({candidateId:body.requestId,candidates:await listClipCandidates(c.env.DB,c.user.id,c.id)}, {status:201});
}
