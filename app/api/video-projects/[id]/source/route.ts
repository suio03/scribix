import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { removeVideoProjectSource } from "@/lib/video-workspace/lifecycle";

type Params = { params: Promise<{ id: string }> };

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
