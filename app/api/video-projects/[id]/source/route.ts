import { presignGet } from "@/lib/r2";
import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { removeVideoProjectSource } from "@/lib/video-workspace/lifecycle";

type Params = { params: Promise<{ id: string }> };

// Short-lived source access for the dashboard's lazy thumbnail extraction.
export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const source = await env.DB.prepare(
    `SELECT source.r2_key
       FROM video_projects project
       JOIN media_assets source
         ON source.id = project.source_asset_id AND source.user_id = project.user_id
      WHERE project.id = ?1 AND project.user_id = ?2 AND project.deleted_at IS NULL
        AND source.kind = 'source' AND source.status = 'ready'
        AND source.deleted_at IS NULL AND source.r2_key IS NOT NULL
        AND (source.expires_at IS NULL OR source.expires_at > CURRENT_TIMESTAMP)`
  ).bind(id, user.id).first<{ r2_key: string }>();
  if (!source) return Response.json({ error: "source_video_missing" }, { status: 404 });
  return Response.json({ url: await presignGet(source.r2_key, 300) }, {
    headers: { "cache-control": "private, no-store" },
  });
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  try {
    const result = await removeVideoProjectSource(
      env.DB,
      env.SCRIBIX_MEDIA,
      user.id,
      id
    );
    if (!result.ok) {
      const status = result.error === "project_not_found"
        ? 404
        : result.error === "source_video_missing"
          ? 410
          : 409;
      return Response.json(result, { status });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error(JSON.stringify({
      event: "video_project_source_delete_failed",
      projectId: id,
      error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    }));
    return Response.json({ error: "delete_failed" }, { status: 502 });
  }
}
