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
};

export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: projectId, jobId } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const render = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM clip_candidates preceding
                     WHERE preceding.project_id = candidate.project_id
                       AND preceding.user_id = candidate.user_id
                       AND preceding.status <> 'deleted'
                       AND preceding.rank < candidate.rank) AS rank,
            candidate.theme, transcript.title,
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

  return new Response(exportArchive(entries), {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": attachmentHeader(`${name}.zip`),
      "content-type": "application/zip",
      "x-content-type-options": "nosniff",
    },
  });
}
