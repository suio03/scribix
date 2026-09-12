import { cf } from "@/lib/cf";
import { bearerToken, verifyScopedJobToken } from "@/lib/video-workspace/job-auth";
import { recordFinalAsset } from "@/lib/video-workspace/final-internal-jobs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const env = await cf();
  const token = bearerToken(request);
  if (!token || !await verifyScopedJobToken(env.VIDEO_WORKER_SIGNING_SECRET, id, token)) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const saved = await recordFinalAsset(env.DB, env.SCRIBIX_MEDIA, id, body);
  return Response.json({ ok: saved }, { status: saved ? 200 : 422 });
}
