import { zipSync } from "fflate";
import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { videoWorkspaceAccessFor } from "@/lib/video-workspace/access";

type Params = { params: Promise<{ id: string; jobId: string }> };

type DownloadRow = {
  version: number;
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
    `SELECT version.version,
            video.r2_key AS video_r2_key,
            cover.r2_key AS cover_r2_key
       FROM render_jobs job
       JOIN project_versions version
         ON version.id = job.project_version_id AND version.user_id = job.user_id
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

  const files: Record<string, Uint8Array> = {
    "scribix-video.mp4": new Uint8Array(await video.arrayBuffer()),
  };
  if (cover) {
    files["scribix-cover.jpg"] = new Uint8Array(await cover.arrayBuffer());
  }
  const archive = zipSync(files, { level: 0 });
  const body = archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength
  ) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="scribix-clip-v${render.version}.zip"`,
      "content-length": String(archive.byteLength),
      "content-type": "application/zip",
      "x-content-type-options": "nosniff",
    },
  });
}
