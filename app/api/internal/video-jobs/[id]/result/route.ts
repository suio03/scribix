import { cf } from "@/lib/cf";
import type { FinalJobResult, PreviewJobFailure, PreviewJobResult } from "@/lib/video-workspace/contracts";
import { bearerToken, verifyScopedJobToken } from "@/lib/video-workspace/job-auth";
import { recordPreviewJobResult } from "@/lib/video-workspace/internal-jobs";
import { recordFinalJobResult, renderJobKind } from "@/lib/video-workspace/final-internal-jobs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const env = await cf();
  const token = bearerToken(request);
  if (!token || !await verifyScopedJobToken(env.VIDEO_WORKER_SIGNING_SECRET, id, token)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: PreviewJobResult | FinalJobResult | PreviewJobFailure;
  try {
    body = await request.json() as PreviewJobResult | FinalJobResult | PreviewJobFailure;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!validResult(body)) {
    return Response.json({ error: "invalid_result" }, { status: 400 });
  }
  const kind = await renderJobKind(env.DB, id);
  const result = kind === "final"
    ? await recordFinalJobResult(env.DB, env.SCRIBIX_MEDIA, id, body as FinalJobResult | PreviewJobFailure)
    : await recordPreviewJobResult(env.DB, env.SCRIBIX_MEDIA, id, body as PreviewJobResult | PreviewJobFailure);
  return result.ok
    ? Response.json({ ok: true })
    : Response.json({ error: result.error }, { status: 422 });
}

function validResult(value: unknown): value is PreviewJobResult | FinalJobResult | PreviewJobFailure {
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
      video?: { bytes?: unknown; durationMs?: unknown; width?: unknown; height?: unknown; videoCodec?: unknown; audioCodec?: unknown };
      cover?: { bytes?: unknown; width?: unknown; height?: unknown; mimeType?: unknown };
    };
  };
  if (result.status === "failed") return typeof result.errorCode === "string";
  if (result.status !== "completed" || !result.output) return false;
  if (result.output.video && result.output.cover) {
    return Number.isInteger(result.output.video.bytes) &&
      Number.isInteger(result.output.video.durationMs) &&
      Number.isInteger(result.output.video.width) &&
      Number.isInteger(result.output.video.height) &&
      typeof result.output.video.videoCodec === "string" &&
      typeof result.output.video.audioCodec === "string" &&
      Number.isInteger(result.output.cover.bytes) &&
      Number.isInteger(result.output.cover.width) &&
      Number.isInteger(result.output.cover.height) &&
      typeof result.output.cover.mimeType === "string";
  }
  return (
    Number.isInteger(result.output.bytes) &&
    Number.isInteger(result.output.durationMs) &&
    Number.isInteger(result.output.width) &&
    Number.isInteger(result.output.height) &&
    typeof result.output.videoCodec === "string" &&
    (typeof result.output.audioCodec === "string" || result.output.audioCodec === null)
  );
}
