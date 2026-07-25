import { auth } from "@/auth";
import { AaiSubmitError, submitTranscript } from "@/lib/aai";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { discordAlert } from "@/lib/discord";
import { isAllowedMedia, isUploadExpired } from "@/lib/media-upload";
import { PLANS, type Tier } from "@/lib/plans";
import { presignGet } from "@/lib/r2";
import { checkQuota, reconcileQuota, reserveQuota } from "@/lib/quota";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId } = await params;

  let body: {
    durationSecEstimate?: number;
    allowPartial?: boolean;
    confirmedPartialMin?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const rawEstimate = body.durationSecEstimate;
  const estimate = rawEstimate == null ? null : Number(rawEstimate);
  if (estimate !== null && (!Number.isFinite(estimate) || estimate <= 0)) {
    return Response.json({ error: "invalid_duration" }, { status: 400 });
  }

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const userId = user.id;

  const row = await env.DB.prepare(
    `SELECT t.id, t.user_id, t.status, t.source, t.audio_r2_key, t.webhook_token,
            t.filename, t.mime_type, t.bytes, t.created_at, u.tier
       FROM transcripts t
       JOIN users u ON u.id = t.user_id
      WHERE t.id = ?1 AND t.deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<{
      id: string;
      user_id: string;
      status: string;
      source: string;
      audio_r2_key: string | null;
      webhook_token: string;
      filename: string | null;
      mime_type: string | null;
      bytes: number | null;
      created_at: string;
      tier: Tier;
    }>();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== userId) return Response.json({ error: "forbidden" }, { status: 403 });
  if (row.status !== "pending") {
    return Response.json({ error: "already_started", status: row.status }, { status: 409 });
  }
  if (!row.audio_r2_key) {
    return Response.json({ error: "no_audio_key" }, { status: 400 });
  }
  if (isUploadExpired(row.created_at)) {
    return Response.json({ error: "upload_expired" }, { status: 410 });
  }

  const plan = PLANS[row.tier];
  if (row.source === "record" && estimate === null) {
    return Response.json({ error: "invalid_duration" }, { status: 400 });
  }
  const allowPartial =
    row.tier === "free" &&
    row.source === "upload" &&
    body.allowPartial === true;
  const rawConfirmedPartialMin = body.confirmedPartialMin;
  const confirmedPartialMin =
    allowPartial && rawConfirmedPartialMin != null
      ? Number(rawConfirmedPartialMin)
      : null;
  if (
    confirmedPartialMin !== null &&
    (!Number.isFinite(confirmedPartialMin) ||
      !Number.isInteger(confirmedPartialMin) ||
      confirmedPartialMin <= 0)
  ) {
    return Response.json(
      { error: "invalid_partial_limit" },
      { status: 400 }
    );
  }
  if (estimate !== null && estimate > plan.maxFileSec) {
    return Response.json(
      { error: "duration_exceeds_tier", maxSec: plan.maxFileSec, tier: row.tier },
      { status: 413 }
    );
  }

  const object = await env.SCRIBIX_MEDIA.head(row.audio_r2_key);
  if (!object) return Response.json({ error: "upload_incomplete" }, { status: 409 });
  if (!row.bytes || object.size !== row.bytes) {
    return Response.json({ error: "upload_size_mismatch" }, { status: 409 });
  }
  const contentType = object.httpMetadata?.contentType?.toLowerCase() ?? "";
  const storedMime = row.mime_type?.toLowerCase() ?? "";
  const effectiveContentType = !contentType || contentType === "application/octet-stream"
    ? storedMime
    : contentType;
  const isVideo = storedMime.startsWith("video/");
  const sizeCap = isVideo ? plan.maxVideoUploadBytes : plan.maxFileBytes;
  if (object.size > sizeCap) {
    return Response.json({ error: "file_too_large", maxBytes: sizeCap }, { status: 413 });
  }
  if (!row.filename || !effectiveContentType || !isAllowedMedia(row.filename, effectiveContentType, isVideo)) {
    return Response.json({ error: "unsupported_media" }, { status: 415 });
  }

  let estimateMin: number;
  if (estimate === null) {
    if (row.tier === "free" && row.source === "upload" && !allowPartial) {
      return Response.json(
        { error: "partial_confirmation_required" },
        { status: 409 }
      );
    }
    const quota = await checkQuota(env.DB, userId, 1);
    if ("error" in quota) {
      if (quota.error === "no_quota") {
        return Response.json(
          {
            error: "no_quota",
            remainingMin: quota.remainingMin,
            capMin: quota.capMin,
            tier: row.tier,
            canUpgrade: row.tier !== "pro",
            suggestedTier: "pro",
          },
          { status: 429 }
        );
      }
      return Response.json({ error: quota.error }, { status: 400 });
    }
    estimateMin = Math.min(Math.ceil(plan.maxFileSec / 60), quota.remainingMin);
  } else {
    estimateMin = Math.ceil(estimate / 60);
  }
  if (confirmedPartialMin !== null) {
    estimateMin = Math.min(estimateMin, confirmedPartialMin);
  }

  const reservation = await reserveQuota(env.DB, userId, estimateMin, {
    allowPartial,
    requireFullEstimate: row.tier === "free" && row.source === "upload",
  });
  if ("error" in reservation) {
    if (reservation.error === "no_quota") {
      return Response.json(
        {
          error: "no_quota",
          remainingMin: reservation.remainingMin,
          capMin: reservation.capMin,
          tier: row.tier,
          canUpgrade: row.tier !== "pro",
          suggestedTier: "pro",
        },
        { status: 429 }
      );
    }
    if (reservation.error === "insufficient_quota") {
      return Response.json(
        {
          error: "insufficient_quota",
          remainingMin: reservation.remainingMin,
          capMin: reservation.capMin,
          neededMin: estimateMin,
          tier: row.tier,
          canUpgrade: row.tier !== "pro",
          suggestedTier: "pro",
        },
        { status: 402 }
      );
    }
    return Response.json({ error: reservation.error }, { status: 400 });
  }
  const reservedMin = reservation.reservedMin;
  const processingLimitSec = reservedMin * 60;

  // Upload-status sentinel before AAI submit. Either AAI accepts (we move to queued)
  // or we throw, which leaves the row at 'uploading' for inline reconcile to mop up.
  const claimed = await env.DB.prepare(
    `UPDATE transcripts
        SET status = 'uploading',
            reserved_minutes = ?1,
            processing_limit_sec = ?2,
            partial_requested = ?3,
            submit_started_at = CURRENT_TIMESTAMP
      WHERE id = ?4 AND status = 'pending'`
  )
    .bind(reservedMin, processingLimitSec, allowPartial ? 1 : 0, transcriptId)
    .run();
  if (!claimed.meta?.changes) {
    await reconcileQuota(env.DB, userId, reservedMin, 0);
    return Response.json({ error: "already_started" }, { status: 409 });
  }

  let audioUrl: string;
  let aaiId: string;
  try {
    audioUrl = await presignGet(row.audio_r2_key, 60 * 60 * 24);
    const webhookUrl =
      process.env.ASSEMBLYAI_WEBHOOK_URL ||
      `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/webhook/assemblyai`;
    const submitted = await submitTranscript({
      audio_url: audioUrl,
      speech_models: plan.speechModels,
      speaker_labels: true,
      language_detection: true,
      audio_end_at: processingLimitSec * 1000,
      webhook_url: webhookUrl || undefined,
      webhook_auth_header_name: webhookUrl ? "X-Scribix-Token" : undefined,
      webhook_auth_header_value: webhookUrl ? row.webhook_token : undefined,
    });
    aaiId = submitted.transcript.id;
    console.info(JSON.stringify({
      event: "aai_submit_succeeded",
      transcriptId,
      attempts: submitted.attempts,
    }));
  } catch (err) {
    const submitError = err instanceof AaiSubmitError ? err : null;
    console.error(JSON.stringify({
      event: "aai_submit_failed",
      transcriptId,
      category: submitError?.category ?? "unknown",
      upstreamStatus: submitError?.status,
      attempts: submitError?.attempts ?? 1,
    }));

    if (submitError?.category === "network" || submitError?.category === "invalid_response") {
      await discordAlert("transcription_failed", {
        stage: "submit_uncertain",
        transcriptId,
        userId,
        category: submitError.category,
        attempts: submitError.attempts,
      });
      return Response.json(
        { error: "aai_submit_uncertain", retryable: false },
        { status: 503 }
      );
    }

    // Refund the reservation — AAI never accepted the job, so no work is
    // outstanding. Without this, presign/AAI outages permanently strand quota.
    const errMsg = err instanceof Error ? err.message : "submit_failed";
    await reconcileQuota(env.DB, userId, reservedMin, 0);
    await env.DB.prepare(
      `UPDATE transcripts
          SET status = 'pending',
              error = ?1,
              reserved_minutes = 0,
              processing_limit_sec = NULL,
              partial_requested = 0
        WHERE id = ?2`
    )
      .bind(errMsg, transcriptId)
      .run();
    await discordAlert("transcription_failed", {
      stage: "submit",
      transcriptId,
      userId,
      error: errMsg.slice(0, 200),
      upstreamStatus: submitError?.status,
      attempts: submitError?.attempts,
    });
    return Response.json({ error: "aai_submit_failed" }, { status: 502 });
  }

  // AAI accepted the job; we MUST persist aai_transcript_id or the row gets
  // stranded in 'uploading' with no way for the webhook to find it. Retry on
  // transient D1 failures; alert on hard failure so ops can recover by hand.
  const persisted = await persistAaiId(env.DB, transcriptId, aaiId);
  if (!persisted) {
    await discordAlert("transcription_failed", {
      stage: "post_submit_db_write",
      transcriptId,
      userId,
      aaiId,
      reservedMin,
    });
    return Response.json({ error: "persist_failed", aaiId }, { status: 500 });
  }

  return Response.json({
    ok: true,
    status: "queued",
    processingLimitSec,
  });
}

async function persistAaiId(db: D1Database, transcriptId: string, aaiId: string): Promise<boolean> {
  const delays = [0, 200, 600];
  for (const ms of delays) {
    if (ms) await new Promise((r) => setTimeout(r, ms));
    try {
      const res = await db
        .prepare(`UPDATE transcripts SET status = 'queued', aai_transcript_id = ?1 WHERE id = ?2`)
        .bind(aaiId, transcriptId)
        .run();
      if (res.meta?.changes) return true;
    } catch {
      // fall through to next attempt
    }
  }
  return false;
}
