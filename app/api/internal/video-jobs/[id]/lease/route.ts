import { cf } from "@/lib/cf";
import { bearerToken, verifyScopedJobToken } from "@/lib/video-workspace/job-auth";
import { leasePreviewJob } from "@/lib/video-workspace/internal-jobs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const env = await cf();
  if (!await authorized(request, env.VIDEO_WORKER_SIGNING_SECRET, id)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await leasePreviewJob(env.DB, id);
  if (!result.ok) {
    const status = result.error === "job_not_found" ? 404 : 409;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json(result.lease);
}

async function authorized(request: Request, secret: string, jobId: string): Promise<boolean> {
  const token = bearerToken(request);
  return token ? verifyScopedJobToken(secret, jobId, token) : false;
}
