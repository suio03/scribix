import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import {
  deleteVideoWorkspaceObjects,
  hardDeleteVideoProjects,
  videoWorkspaceDeletionForProject,
} from "@/lib/video-workspace/lifecycle";
import { ownedVideoProject } from "@/lib/video-workspace/ownership";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const project = await ownedVideoProject(env.DB, id, user.id);
  return project
    ? Response.json({ project })
    : Response.json({ error: "not_found" }, { status: 404 });
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const activeJob = await env.DB.prepare(
    `SELECT id FROM render_jobs
      WHERE project_id = ?1 AND user_id = ?2
        AND status IN ('queued', 'preparing', 'running', 'uploading')
      LIMIT 1`
  )
    .bind(id, user.id)
    .first<{ id: string }>();
  if (activeJob) return Response.json({ error: "project_job_active" }, { status: 409 });

  const deletion = await videoWorkspaceDeletionForProject(env.DB, user.id, id);
  if (!deletion) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    await deleteVideoWorkspaceObjects(env.SCRIBIX_MEDIA, deletion.r2Keys);
    await hardDeleteVideoProjects(env.DB, user.id, deletion.projectIds);
  } catch (error) {
    console.error(JSON.stringify({
      event: "video_project_delete_failed",
      projectId: id,
      error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    }));
    return Response.json({ error: "delete_failed" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
