import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { clipflightEnabled } from "@/lib/clipflight";
import { presignGet } from "@/lib/r2";
export async function GET(request: Request) {
  const session = await auth(); if (!session) return Response.json({error: "unauthorized"}, {status: 401});
  const env = await cf(); const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user || !clipflightEnabled(user.id)) return Response.json({error: "not_found"}, {status: 404});
  const q = new URL(request.url).searchParams;
  const row = await env.DB.prepare(`SELECT j.id, j.project_id, c.id AS candidate_id, c.draft_revision, c.publish_draft_json,
    a.r2_key, a.bytes, a.width, a.height, a.duration_ms, c.theme AS title
    FROM render_jobs j JOIN project_versions v ON v.id = j.project_version_id AND v.user_id = j.user_id
    JOIN clip_candidates c ON c.id = v.candidate_id AND c.user_id = j.user_id
    JOIN video_projects p ON p.id = j.project_id AND p.user_id = j.user_id
    JOIN media_assets a ON a.id = j.output_asset_id AND a.user_id = j.user_id
    WHERE j.id = ? AND j.project_id = ? AND c.id = ? AND j.user_id = ? AND j.kind = 'final' AND j.superseded_at IS NULL
    AND p.deleted_at IS NULL AND c.status <> 'deleted' AND c.draft_edl_json = v.edl_json
    AND json_remove(c.draft_render_spec_json, '$.coverTitle', '$.coverTimelineMs') = json_remove(v.render_spec_json, '$.coverTitle', '$.coverTimelineMs')
    AND a.status = 'ready' AND a.deleted_at IS NULL AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)`)
    .bind(q.get("renderJobId"), q.get("projectId"), q.get("candidateId"), user.id)
    .first<{id: string; project_id: string; candidate_id: string; draft_revision: number; publish_draft_json: string | null; r2_key: string; bytes: number; width: number; height: number; duration_ms: number; title: string}>();
  if (!row || !await env.SCRIBIX_MEDIA.head(row.r2_key)) return Response.json({error: "render_unavailable"}, {status: 409});
  const copy = row.publish_draft_json ? JSON.parse(row.publish_draft_json) : null;
  return Response.json({projectId: row.project_id, candidateId: row.candidate_id, revision: row.draft_revision, storageKey: `scribix:compose:${user.id}:${row.project_id}:${row.candidate_id}:${row.id}`,
    copyStorageKey: `scribix:platform-copy:${user.id}:${row.project_id}:${row.candidate_id}`,
    previewUrl: await presignGet(row.r2_key, 3600), title: copy?.title || row.title,
    caption: copy ? [copy.body, copy.tags?.map((tag: string) => `#${tag.replace(/^#/, "")}`).join(" ")].filter(Boolean).join("\n\n") : "",
    media: {id: row.id, filename: row.title, sizeBytes: row.bytes, contentType: "video/mp4", durationMs: row.duration_ms, width: row.width, height: row.height,
      rotation: 0, fps: null, videoCodec: "h264", audioCodec: "aac", probeStatus: "ok", probeError: null, checks: [], createdAt: 0}}, {headers: {"Cache-Control": "no-store"}});
}
