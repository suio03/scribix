import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { checkQuota } from "@/lib/quota";
import {
  validateUploadPreflight,
  type PreflightInput,
} from "@/lib/upload-preflight";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: Partial<PreflightInput>;
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

  const estimateMin = durationSec === null ? 1 : Math.ceil(durationSec / 60);
  const quota = await checkQuota(env.DB, user.id, estimateMin);
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

  return Response.json({
    ok: true,
    pipeline: decision.pipeline,
    fallbackReason: decision.fallbackReason,
    tier: user.tier,
    remainingMin: quota.remainingMin,
    capMin: quota.capMin,
  });
}
