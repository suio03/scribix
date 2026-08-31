import { cf } from "@/lib/cf";
import { bearerToken, verifyScopedJobToken } from "@/lib/video-workspace/job-auth";
import { markPreviewJobUploading } from "@/lib/video-workspace/internal-jobs";
import { markFinalJobUploading, renderJobKind } from "@/lib/video-workspace/final-internal-jobs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const env = await cf();
  const token = bearerToken(request);
  if (!token || !await verifyScopedJobToken(env.VIDEO_WORKER_SIGNING_SECRET, id, token)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const kind = await renderJobKind(env.DB, id);
  const updated = kind === "final"
    ? await markFinalJobUploading(env.DB, id)
    : await markPreviewJobUploading(env.DB, id);
  return updated
    ? Response.json({ ok: true })
    : Response.json({ error: "job_not_available" }, { status: 409 });
}
