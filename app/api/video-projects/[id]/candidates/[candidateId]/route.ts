import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";

type Params = {
  params: Promise<{ id: string; candidateId: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: projectId, candidateId } = await params;
  const body = await request.json<{ title?: unknown }>().catch(() => null);
  const title = typeof body?.title === "string"
    ? body.title.trim().replace(/\s+/g, " ").slice(0, 160)
    : "";
  if (!title) return Response.json({ error: "invalid_title" }, { status: 400 });

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const result = await env.DB.prepare(
    `UPDATE clip_candidates
        SET theme = ?1
      WHERE id = ?2
        AND project_id = ?3
        AND user_id = ?4
        AND status <> 'deleted'
        AND EXISTS (
          SELECT 1 FROM video_projects
           WHERE id = ?3 AND user_id = ?4 AND deleted_at IS NULL
        )`
  )
    .bind(title, candidateId, projectId, user.id)
    .run();
  return result.meta?.changes
    ? Response.json({ ok: true, title })
    : Response.json({ error: "candidate_not_found" }, { status: 404 });
}
