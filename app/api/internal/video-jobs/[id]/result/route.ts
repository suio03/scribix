import { cf } from "@/lib/cf";
import type { PreviewJobFailure, PreviewJobResult } from "@/lib/video-workspace/contracts";
import { bearerToken, verifyScopedJobToken } from "@/lib/video-workspace/job-auth";
import { recordPreviewJobResult } from "@/lib/video-workspace/internal-jobs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const env = await cf();
  const token = bearerToken(request);
  if (!token || !await verifyScopedJobToken(env.VIDEO_WORKER_SIGNING_SECRET, id, token)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: PreviewJobResult | PreviewJobFailure;
  try {
    body = await request.json() as PreviewJobResult | PreviewJobFailure;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!validResult(body)) {
    return Response.json({ error: "invalid_result" }, { status: 400 });
  }
  const result = await recordPreviewJobResult(env.DB, env.SCRIBIX_MEDIA, id, body);
  return result.ok
    ? Response.json({ ok: true })
    : Response.json({ error: result.error }, { status: 422 });
}

function validResult(value: unknown): value is PreviewJobResult | PreviewJobFailure {
  if (!value || typeof value !== "object") return false;
  const result = value as {
    status?: unknown;
    errorCode?: unknown;
    output?: {
      bytes?: unknown;
      durationMs?: unknown;
      width?: unknown;
      height?: unknown;
      videoCodec?: unknown;
      audioCodec?: unknown;
    };
  };
  if (result.status === "failed") return typeof result.errorCode === "string";
  if (result.status !== "completed" || !result.output) return false;
  return (
    Number.isInteger(result.output.bytes) &&
    Number.isInteger(result.output.durationMs) &&
    Number.isInteger(result.output.width) &&
    Number.isInteger(result.output.height) &&
    typeof result.output.videoCodec === "string" &&
    (typeof result.output.audioCodec === "string" || result.output.audioCodec === null)
  );
}
