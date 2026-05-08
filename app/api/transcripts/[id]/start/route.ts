import { auth } from "@/auth";
import { submitTranscript } from "@/lib/aai";
import { cf } from "@/lib/cf";
import { discordAlert } from "@/lib/discord";
import { PLANS, type Tier } from "@/lib/plans";
import { presignGet } from "@/lib/r2";
import { reconcileQuota, reserveQuota } from "@/lib/quota";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id: transcriptId } = await params;

  let body: { durationSecEstimate?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const estimate = Number(body.durationSecEstimate);
  if (!Number.isFinite(estimate) || estimate <= 0) {
    return Response.json({ error: "invalid_duration" }, { status: 400 });
  }

  const env = cf();

  const row = await env.DB.prepare(
    `SELECT t.id, t.user_id, t.status, t.audio_r2_key, t.webhook_token, u.tier
       FROM transcripts t
       JOIN users u ON u.id = t.user_id
      WHERE t.id = ?1 AND t.deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<{
      id: string;
      user_id: string;
      status: string;
      audio_r2_key: string | null;
      webhook_token: string;
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

  const plan = PLANS[row.tier];
  const estimateMin = Math.ceil(estimate / 60);
  if (estimate > plan.maxFileSec) {
    return Response.json(
      { error: "duration_exceeds_tier", maxSec: plan.maxFileSec, tier: row.tier },
      { status: 413 }
    );
  }

  const reservation = await reserveQuota(env.DB, userId, estimateMin);
  if ("error" in reservation) {
    if (reservation.error === "no_quota") {
      return Response.json(
        {
          error: "no_quota",
          remainingMin: reservation.remainingMin,
          capMin: reservation.capMin,
          tier: row.tier,
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
        },
        { status: 402 }
      );
    }
    return Response.json({ error: reservation.error }, { status: 400 });
  }
  const reservedMin = reservation.reservedMin;

  // Upload-status sentinel before AAI submit. Either AAI accepts (we move to queued)
  // or we throw, which leaves the row at 'uploading' for inline reconcile to mop up.
  await env.DB.prepare(
    `UPDATE transcripts SET status = 'uploading', reserved_minutes = ?1 WHERE id = ?2`
  )
    .bind(reservedMin, transcriptId)
    .run();

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
      audio_end_at: reservedMin * 60 * 1000,
      webhook_url: webhookUrl || undefined,
      webhook_auth_header_name: webhookUrl ? "X-Scribix-Token" : undefined,
      webhook_auth_header_value: webhookUrl ? row.webhook_token : undefined,
    });
    aaiId = submitted.id;
  } catch (err) {
    // Refund the reservation — AAI never accepted the job, so no work is
    // outstanding. Without this, presign/AAI outages permanently strand quota.
    const errMsg = err instanceof Error ? err.message : "submit_failed";
    await reconcileQuota(env.DB, userId, reservedMin, 0);
    await env.DB.prepare(
      `UPDATE transcripts SET status = 'error', error = ?1, reserved_minutes = 0 WHERE id = ?2`
    )
      .bind(errMsg, transcriptId)
      .run();
    await discordAlert("transcription_failed", {
      stage: "submit",
      transcriptId,
      userId,
      error: errMsg.slice(0, 200),
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

  return Response.json({ ok: true, status: "queued" });
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
