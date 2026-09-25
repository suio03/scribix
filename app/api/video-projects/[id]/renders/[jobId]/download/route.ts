import { parsePublishDraft, publishText } from "@/lib/video-workspace/publish";
import { attachmentHeader, exportArchive, exportFileName } from "@/lib/video-workspace/export-archive";
import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { videoWorkspaceAccessFor } from "@/lib/video-workspace/access";

type Params = { params: Promise<{ id: string; jobId: string }> };

type DownloadRow = {
  rank: number;
  theme: string;
  title: string;
  video_r2_key: string;
  cover_r2_key: string;
  publish_draft_json: string | null;
};

export async function GET(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: projectId, jobId } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const requestedFormat = new URL(request.url).searchParams.get("format");
  if (requestedFormat === "video" || requestedFormat === "cover") {
    if (requestedFormat === "cover" && !videoWorkspaceAccessFor(user.tier).canEditClips) return Response.json({ error: "upgrade_required" }, { status: 402 });
    const asset = await env.DB.prepare(`SELECT a.r2_key, t.title, c.theme,
        (SELECT COUNT(*) FROM clip_candidates preceding
          WHERE preceding.project_id = c.project_id AND preceding.user_id = c.user_id
            AND preceding.status <> 'deleted' AND preceding.rank < c.rank) AS rank
      FROM render_jobs j
      JOIN video_projects p ON p.id = j.project_id AND p.user_id = j.user_id
      JOIN transcripts t ON t.id = p.transcript_id
      JOIN project_versions v ON v.id = j.project_version_id AND v.user_id = j.user_id
      JOIN clip_candidates c ON c.id = v.candidate_id AND c.user_id = j.user_id
      JOIN media_assets a ON a.id = CASE WHEN ?4 = 'video' THEN j.output_asset_id ELSE j.cover_asset_id END AND a.user_id = j.user_id
      WHERE j.id = ?1 AND j.project_id = ?2 AND j.user_id = ?3 AND j.kind = 'final'
        AND j.superseded_at IS NULL AND p.deleted_at IS NULL AND a.status = 'ready' AND a.deleted_at IS NULL
        AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)`)
      .bind(jobId, projectId, user.id, requestedFormat).first<{ r2_key: string; title: string; theme: string; rank: number }>();
    const object = asset?.r2_key ? await env.SCRIBIX_MEDIA.get(asset.r2_key) : null;
    if (!asset || !object) return Response.json({ error: "render_asset_missing" }, { status: 410 });
    return new Response(object.body, { headers: {
      "cache-control": "private, no-store", "content-disposition": attachmentHeader(`${exportFileName(asset.title, asset.rank + 1, asset.theme)}${requestedFormat === "video" ? ".mp4" : "-cover.jpg"}`),
      "content-type": requestedFormat === "video" ? "video/mp4" : "image/jpeg", "x-content-type-options": "nosniff",
    } });
  }
  const render = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM clip_candidates preceding
                     WHERE preceding.project_id = candidate.project_id
                       AND preceding.user_id = candidate.user_id
                       AND preceding.status <> 'deleted'
                       AND preceding.rank < candidate.rank) AS rank,
            candidate.theme, transcript.title, version.publish_draft_json,
            video.r2_key AS video_r2_key,
            cover.r2_key AS cover_r2_key
       FROM render_jobs job
       JOIN project_versions version
         ON version.id = job.project_version_id AND version.user_id = job.user_id
       JOIN clip_candidates candidate ON candidate.id = version.candidate_id AND candidate.user_id = job.user_id
       JOIN video_projects project ON project.id = job.project_id AND project.user_id = job.user_id
       JOIN transcripts transcript ON transcript.id = project.transcript_id
       JOIN media_assets video
         ON video.id = job.output_asset_id AND video.user_id = job.user_id
       JOIN media_assets cover
         ON cover.id = job.cover_asset_id AND cover.user_id = job.user_id
      WHERE job.id = ?1
        AND job.project_id = ?2
        AND job.user_id = ?3
        AND job.kind = 'final'
        AND project.deleted_at IS NULL
        AND candidate.status <> 'deleted'
        AND transcript.deleted_at IS NULL
        AND job.status = 'completed'
        AND job.superseded_at IS NULL
        AND video.status = 'ready'
        AND video.deleted_at IS NULL
        AND video.r2_key IS NOT NULL
        AND (video.expires_at IS NULL OR video.expires_at > CURRENT_TIMESTAMP)
        AND cover.status = 'ready'
        AND cover.deleted_at IS NULL
        AND cover.r2_key IS NOT NULL
        AND (cover.expires_at IS NULL OR cover.expires_at > CURRENT_TIMESTAMP)`
  )
    .bind(jobId, projectId, user.id)
    .first<DownloadRow>();
  if (!render) return Response.json({ error: "render_not_found" }, { status: 404 });

  const url = new URL(request.url);
  const packageId = url.searchParams.get("packageId");
  if (packageId) {
    const saved = await env.DB.prepare("SELECT publish_draft_json FROM publish_packages WHERE id = ?1 AND user_id = ?2 AND project_id = ?3 AND render_job_id = ?4").bind(packageId, user.id, projectId, jobId).first<{ publish_draft_json: string }>();
    if (!saved) return Response.json({ error: "not_found" }, { status: 404 });
    render.publish_draft_json = saved.publish_draft_json;
  }
  const includeCover = videoWorkspaceAccessFor(user.tier).canEditClips;
  const [video, cover] = await Promise.all([
    env.SCRIBIX_MEDIA.get(render.video_r2_key),
    includeCover ? env.SCRIBIX_MEDIA.get(render.cover_r2_key) : Promise.resolve(null),
  ]);
  if (!video || (includeCover && !cover)) {
    return Response.json({ error: "render_assets_missing" }, { status: 410 });
  }

  const name = exportFileName(render.title, render.rank + 1, render.theme);
  const entries = [{ name: `${name}.mp4`, body: video.body }];
  if (cover) entries.push({ name: `${name}-cover.jpg`, body: cover.body });
  if (includeCover && render.publish_draft_json) {
    const draft = parsePublishDraft(JSON.parse(render.publish_draft_json));
    if (draft) entries.push({ name: `${name}-post.txt`, body: new Blob([publishText(draft)], { type: "text/plain;charset=utf-8" }).stream() });
  }

  return new Response(exportArchive(entries), {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": attachmentHeader(`${name}.zip`),
      "content-type": "application/zip",
      "x-content-type-options": "nosniff",
    },
  });
}

// Freeze copy at the explicit download action. Video and cover already belong to an immutable render version.
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "not_found" }, { status: 404 });
  if (!videoWorkspaceAccessFor(user.tier).canEditClips) return Response.json({ error: "upgrade_required" }, { status: 402 });
  const { id, jobId } = await params;
  let body: { expectedRevision?: number };
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
  if (!body || !Number.isInteger(body.expectedRevision)) return Response.json({ error: "invalid_request" }, { status: 400 });
  const packageId = crypto.randomUUID();
  const inserted = await env.DB.prepare(`INSERT INTO publish_packages (id, user_id, project_id, render_job_id, publish_draft_json)
    SELECT ?1, j.user_id, j.project_id, j.id, c.publish_draft_json
    FROM render_jobs j JOIN project_versions v ON v.id = j.project_version_id AND v.user_id = j.user_id
    JOIN clip_candidates c ON c.id = v.candidate_id AND c.user_id = j.user_id
    JOIN video_projects p ON p.id = j.project_id AND p.user_id = j.user_id
    WHERE j.id = ?2 AND j.user_id = ?3 AND j.project_id = ?4 AND j.status = 'completed'
      AND j.superseded_at IS NULL AND p.deleted_at IS NULL AND c.status <> 'deleted'
      AND c.draft_revision = ?5 AND c.draft_edl_json = v.edl_json
      AND c.draft_render_spec_json = v.render_spec_json AND c.publish_draft_json IS NOT NULL`)
    .bind(packageId, jobId, user.id, id, body.expectedRevision).run();
  if (!inserted.meta.changes) return Response.json({ error: "draft_conflict" }, { status: 409 });
  return Response.json({ url: `/api/video-projects/${id}/renders/${jobId}/download?packageId=${packageId}` });
}
