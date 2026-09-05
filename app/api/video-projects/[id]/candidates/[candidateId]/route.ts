import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { videoWorkspaceAccessFor } from "@/lib/video-workspace/access";
import { listClipCandidates } from "@/lib/video-workspace/candidates";
import { deleteManualClipCandidate } from "@/lib/video-workspace/lifecycle";

type Params = {
  params: Promise<{ id: string; candidateId: string }>;
};

export async function DELETE(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: projectId, candidateId } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  if (!videoWorkspaceAccessFor(user.tier).canEditClips) {
    return Response.json({ error: "upgrade_required" }, { status: 402 });
  }
  const result = await deleteManualClipCandidate(
    env.DB,
    env.SCRIBIX_MEDIA,
    user.id,
    projectId,
    candidateId
  );
  if (!result.ok) {
    const status = result.error === "candidate_not_found"
      ? 404
      : result.error === "candidate_job_active"
        ? 409
        : 400;
    return Response.json(result, { status });
  }
  const candidates = await listClipCandidates(env.DB, user.id, projectId);
  return Response.json({ ok: true, candidates });
}

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
  if (!videoWorkspaceAccessFor(user.tier).canEditClips) {
    return Response.json({ error: "upgrade_required" }, { status: 402 });
  }
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
