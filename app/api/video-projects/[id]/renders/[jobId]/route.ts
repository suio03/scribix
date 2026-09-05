import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { videoWorkspaceAccessFor } from "@/lib/video-workspace/access";
import { removeFinalRender, retryFinalRender } from "@/lib/video-workspace/final-jobs";

type Params = { params: Promise<{ id: string; jobId: string }> };

export async function DELETE(_: Request, { params }: Params) {
  const context = await contextFor(params);
  if (context instanceof Response) return context;
  const result = await removeFinalRender(
    context.env.DB,
    context.env.SCRIBIX_MEDIA,
    context.env.VIDEO_RENDER_QUEUE,
    context.userId,
    context.projectId,
    context.jobId
  );
  return result.ok
    ? Response.json(result)
    : Response.json(result, { status: result.error === "job_not_found" ? 404 : 409 });
}

export async function POST(_: Request, { params }: Params) {
  const context = await contextFor(params);
  if (context instanceof Response) return context;
  if (!context.canEdit) {
    return Response.json({ error: "upgrade_required" }, { status: 402 });
  }
  const result = await retryFinalRender(
    context.env.DB,
    context.env.VIDEO_RENDER_QUEUE,
    context.userId,
    context.projectId,
    context.jobId
  );
  return result.ok
    ? Response.json(result, { status: 202 })
    : Response.json(result, {
        status: result.error === "job_not_found"
          ? 404
          : result.error === "render_concurrency_limit"
            ? 429
            : 409,
      });
}

async function contextFor(params: Params["params"]): Promise<
  | {
      env: CloudflareEnv;
      userId: string;
      projectId: string;
      jobId: string;
      canEdit: boolean;
    }
  | Response
> {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id, jobId } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  return user
    ? {
        env,
        userId: user.id,
        projectId: id,
        jobId,
        canEdit: videoWorkspaceAccessFor(user.tier).canEditClips,
      }
    : Response.json({ error: "user_not_found" }, { status: 404 });
}
