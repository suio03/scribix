import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { newId, newWebhookToken } from "@/lib/ids";
import { PLANS, type Tier } from "@/lib/plans";
import { checkQuota } from "@/lib/quota";
import { presignPut, R2 } from "@/lib/r2";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    filename?: string;
    bytes?: number;
    mime?: string;
    durationSec?: number;
    isVideo?: boolean;
    source?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const { filename, bytes, mime } = body;
  if (!filename || typeof bytes !== "number" || !mime) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }
  const durationSec = Number(body.durationSec);
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return Response.json({ error: "invalid_duration" }, { status: 400 });
  }
  const isVideo = body.isVideo === true;
  const source: "upload" | "record" = body.source === "record" ? "record" : "upload";

  const env = cf();
  const userRow = await getOrCreateCurrentUser(env.DB, session);
  if (!userRow) return Response.json({ error: "user_not_found" }, { status: 404 });
  const userId = userRow.id;

  const plan = PLANS[userRow.tier];

  // Per-file duration cap. Applies to both audio + video.
  if (durationSec > plan.maxFileSec) {
    return Response.json(
      { error: "duration_exceeds_tier", maxSec: plan.maxFileSec, tier: userRow.tier },
      { status: 413 }
    );
  }

  // Per-file size cap. Audio uploads use maxFileBytes; video uploads use a
  // larger maxVideoUploadBytes ceiling because video is extracted client-side
  // to ~64 kbps mono MP3 before /start, but we still need a hard ceiling so a
  // malicious client can't claim isVideo=true and PUT an unbounded blob to R2.
  const sizeCap = isVideo ? plan.maxVideoUploadBytes : plan.maxFileBytes;
  if (bytes > sizeCap) {
    return Response.json(
      { error: "file_too_large", maxBytes: sizeCap },
      { status: 413 }
    );
  }

  // Pre-flight quota check (read-only). Atomic reserve still happens at /start.
  const estimateMin = Math.ceil(durationSec / 60);
  const quotaCheck = await checkQuota(env.DB, userId, estimateMin);
  if ("error" in quotaCheck) {
    if (quotaCheck.error === "no_quota") {
      return Response.json(
        {
          error: "no_quota",
          remainingMin: quotaCheck.remainingMin,
          capMin: quotaCheck.capMin,
          tier: userRow.tier,
        },
        { status: 429 }
      );
    }
    if (quotaCheck.error === "insufficient_quota") {
      return Response.json(
        {
          error: "insufficient_quota",
          remainingMin: quotaCheck.remainingMin,
          capMin: quotaCheck.capMin,
          neededMin: estimateMin,
          tier: userRow.tier,
        },
        { status: 402 }
      );
    }
    return Response.json({ error: quotaCheck.error }, { status: 400 });
  }

  const transcriptId = newId();
  // Video uploads always land in R2 as MP3 — force the key extension to match
  // what gets PUT, so R2 keys don't lie about contents.
  const sourceExt = (filename.split(".").pop() ?? "bin").toLowerCase().slice(0, 8);
  const ext = isVideo ? "mp3" : sourceExt;
  const audioKey = R2.audioKey(userId, transcriptId, ext);
  const webhookToken = newWebhookToken();
  const title = filename.replace(/\.[^.]+$/, "").slice(0, 200) || "Untitled";
  const storedMime = isVideo ? "audio/mpeg" : mime;

  await env.DB.prepare(
    `INSERT INTO transcripts
       (id, user_id, title, status, source, audio_r2_key, filename, mime_type, bytes, speech_model, webhook_token)
     VALUES (?1, ?2, ?3, 'pending', ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
  )
    .bind(
      transcriptId,
      userId,
      title,
      source,
      audioKey,
      filename,
      storedMime,
      bytes,
      plan.speechModels[0],
      webhookToken
    )
    .run();

  const uploadUrl = await presignPut(audioKey, 60 * 60 * 24);
  return Response.json({ transcriptId, uploadUrl, expiresInSec: 60 * 60 * 24 });
}
