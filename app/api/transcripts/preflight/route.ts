import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { checkQuota } from "@/lib/quota";
import {
  validateUploadPreflight,
  type PreflightInput,
} from "@/lib/upload-preflight";
import { videoSourceStorageForUser } from "@/lib/video-workspace/retention";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: Partial<PreflightInput> & {
    allowPartial?: boolean;
    source?: "upload" | "record";
    workflow?: "transcript" | "video_clips";
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    typeof body.filename !== "string" ||
    !body.filename ||
    typeof body.bytes !== "number" ||
    !Number.isFinite(body.bytes) ||
    body.bytes <= 0 ||
    typeof body.mime !== "string" ||
    !body.mime ||
    typeof body.isVideo !== "boolean"
  ) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }
  if (body.workflow !== undefined && body.workflow !== "transcript" && body.workflow !== "video_clips") {
    return Response.json({ error: "invalid_workflow" }, { status: 400 });
  }
  const workflow = body.workflow ?? "transcript";
  if (workflow === "video_clips" && (!body.isVideo || body.source === "record")) {
    return Response.json({ error: "video_clip_source_required" }, { status: 400 });
  }

  const rawDuration = body.durationSec;
  const durationSec = rawDuration == null ? null : Number(rawDuration);
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const input: PreflightInput = {
    filename: body.filename,
    bytes: body.bytes,
    mime: body.mime,
    durationSec,
    isVideo: body.isVideo,
  };
  const decision = validateUploadPreflight(input, user.tier);
  if ("error" in decision) {
    const status = decision.error === "unsupported_media"
      ? 415
      : decision.error === "invalid_duration"
      ? 400
      : 413;
    return Response.json(decision, { status });
  }

  let sourceStorage = null;
  if (workflow === "video_clips") {
    sourceStorage = await videoSourceStorageForUser(env.DB, user.id, user.tier);
    if (body.bytes > sourceStorage.availableBytes) {
      return Response.json(
        {
          error: "video_source_storage_limit",
          usedBytes: sourceStorage.usedBytes,
          limitBytes: sourceStorage.limitBytes,
          requiredBytes: body.bytes,
          retentionDays: sourceStorage.retentionDays,
        },
        { status: 413 }
      );
    }
  }

  const estimateMin = durationSec === null ? 1 : Math.ceil(durationSec / 60);
  const isFreeUpload = user.tier === "free" && body.source !== "record";
  const allowPartial = isFreeUpload && body.allowPartial === true;
  const quota = await checkQuota(env.DB, user.id, estimateMin, {
    // Free uploads need a read-only quota snapshot so the UI can ask for
    // consent before any upload starts.
    allowPartial: isFreeUpload,
  });
  if ("error" in quota) {
    if (quota.error === "no_quota" || quota.error === "insufficient_quota") {
      return Response.json(
        {
          error: quota.error,
          remainingMin: quota.remainingMin,
          capMin: quota.capMin,
          neededMin: estimateMin,
          tier: user.tier,
          canUpgrade: user.tier !== "pro",
          suggestedTier: "pro",
        },
        { status: quota.error === "no_quota" ? 429 : 402 }
      );
    }
    return Response.json({ error: quota.error }, { status: 400 });
  }

  const requiresPartialConfirmation =
    isFreeUpload &&
    (durationSec === null || estimateMin > quota.remainingMin);
  const processableMin =
    durationSec === null
      ? quota.remainingMin
      : Math.min(estimateMin, quota.remainingMin);

  return Response.json({
    ok: true,
    pipeline: workflow === "video_clips" ? "direct_video" : decision.pipeline,
    fallbackReason: workflow === "video_clips" ? undefined : decision.fallbackReason,
    tier: user.tier,
    remainingMin: quota.remainingMin,
    capMin: quota.capMin,
    processableMin,
    requiresPartialConfirmation: requiresPartialConfirmation && !allowPartial,
    sourceStorage,
  });
}
