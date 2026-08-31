import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { createFinalRender, listFinalRenders } from "@/lib/video-workspace/final-jobs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const context = await renderContext(params);
  if (context instanceof Response) return context;
  const renders = await listFinalRenders(context.env.DB, context.userId, context.projectId);
  return Response.json({ renders });
}

export async function POST(request: Request, { params }: Params) {
  const context = await renderContext(params);
  if (context instanceof Response) return context;
  let body: { candidateId?: unknown; expectedRevision?: unknown; idempotencyKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    typeof body.candidateId !== "string" ||
    !Number.isInteger(body.expectedRevision) ||
    typeof body.idempotencyKey !== "string"
  ) {
    return Response.json({ error: "invalid_render_request" }, { status: 400 });
  }
  const result = await createFinalRender(
    context.env.DB,
    context.env.VIDEO_RENDER_QUEUE,
    context.userId,
    context.projectId,
    body.candidateId,
    Number(body.expectedRevision),
    body.idempotencyKey
  );
  if (!result.ok) {
    const status = result.error === "project_not_found"
      ? 404
      : result.error === "source_video_missing"
        ? 410
        : result.error === "render_concurrency_limit" || result.error === "render_daily_limit"
          ? 429
        : result.error === "draft_conflict" || result.error === "idempotency_conflict"
          ? 409
          : 400;
    return Response.json(result, { status });
  }
  return Response.json(result, { status: result.existing ? 200 : 202 });
}

async function renderContext(params: Params["params"]): Promise<
  | { env: CloudflareEnv; userId: string; projectId: string }
  | Response
> {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  return user
    ? { env, userId: user.id, projectId: id }
    : Response.json({ error: "user_not_found" }, { status: 404 });
}
