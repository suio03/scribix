import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { newId } from "@/lib/ids";

type Params = {
  params: Promise<{ id: string; candidateId: string }>;
};

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: projectId, candidateId } = await params;
  const feedback = await readFeedback(req);
  if (feedback instanceof Response) return feedback;

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const candidate = await env.DB.prepare(
    `SELECT c.id, c.status
       FROM clip_candidates c
       JOIN video_projects p
         ON p.id = c.project_id AND p.user_id = c.user_id
      WHERE c.id = ?1
        AND c.project_id = ?2
        AND c.user_id = ?3
        AND c.status <> 'deleted'
        AND p.deleted_at IS NULL`
  )
    .bind(candidateId, projectId, user.id)
    .first<{ id: string; status: string }>();
  if (!candidate) return Response.json({ error: "not_found" }, { status: 404 });
  if (candidate.status === feedback) {
    if (feedback === "accepted") {
      await env.DB.prepare(
        `UPDATE clip_candidates
            SET status = 'suggested'
          WHERE project_id = ?1
            AND user_id = ?2
            AND id <> ?3
            AND status = 'accepted'`
      )
        .bind(projectId, user.id, candidateId)
        .run();
    }
    return Response.json({ ok: true, status: feedback, recorded: false });
  }

  await env.DB.batch([
    ...(feedback === "accepted"
      ? [env.DB.prepare(
          `UPDATE clip_candidates
              SET status = 'suggested'
            WHERE project_id = ?1
              AND user_id = ?2
              AND id <> ?3
              AND status = 'accepted'`
        ).bind(projectId, user.id, candidateId)]
      : []),
    env.DB.prepare(
      `UPDATE clip_candidates
          SET status = ?1
        WHERE id = ?2 AND project_id = ?3 AND user_id = ?4`
    ).bind(feedback, candidateId, projectId, user.id),
    env.DB.prepare(
      `INSERT INTO clip_candidate_feedback_events
         (id, user_id, project_id, candidate_id, feedback)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    ).bind(newId(), user.id, projectId, candidateId, feedback),
  ]);

  return Response.json({
    ok: true,
    status: feedback,
    recorded: true,
    exclusive: feedback === "accepted",
  });
}

async function readFeedback(
  req: Request
): Promise<"accepted" | "rejected" | Response> {
  let body: { feedback?: unknown };
  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  return body.feedback === "accepted" || body.feedback === "rejected"
    ? body.feedback
    : Response.json({ error: "invalid_feedback" }, { status: 400 });
}
