import { getParagraphs, getSentences, getTranscript } from "@/lib/aai";
import { resolveAaiDuration } from "@/lib/aai-duration";
import { cf } from "@/lib/cf";
import { discordAlert } from "@/lib/discord";
import { reconcileQuota, settledTranscriptionMinutes } from "@/lib/quota";
import { R2 } from "@/lib/r2";

export async function POST(req: Request) {
  let payload: { transcript_id?: string; status?: string };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const aaiId = payload.transcript_id;
  if (!aaiId) return Response.json({ error: "missing_id" }, { status: 400 });

  const env = await cf();
  const token = req.headers.get("x-scribix-token");

  let row = await env.DB.prepare(
    `SELECT id, user_id, webhook_token, reserved_minutes, processing_limit_sec,
            submit_started_at, status
       FROM transcripts WHERE aai_transcript_id = ?1`
  )
    .bind(aaiId)
    .first<Row>();
  if (!row && token) {
    const candidate = await env.DB.prepare(
      `SELECT id, user_id, webhook_token, reserved_minutes, processing_limit_sec,
              submit_started_at, status
         FROM transcripts
        WHERE webhook_token = ?1
          AND status = 'uploading'
          AND aai_transcript_id IS NULL`
    )
      .bind(token)
      .first<Row>();
    if (candidate) {
      const claimed = await env.DB.prepare(
        `UPDATE transcripts
            SET aai_transcript_id = ?1, status = 'queued'
          WHERE id = ?2
            AND webhook_token = ?3
            AND status = 'uploading'
            AND aai_transcript_id IS NULL`
      )
        .bind(aaiId, candidate.id, token)
        .run();
      if (claimed.meta?.changes) row = { ...candidate, status: "queued" };
      else {
        row = await env.DB.prepare(
          `SELECT id, user_id, webhook_token, reserved_minutes, processing_limit_sec,
                  submit_started_at, status
             FROM transcripts WHERE aai_transcript_id = ?1`
        )
          .bind(aaiId)
          .first<Row>();
      }
    }
  }
  if (!row) {
    // 200 to stop AAI retrying — we don't have this transcript on our side.
    return Response.json({ ok: true, ignored: "unknown_transcript" });
  }

  if (token !== row.webhook_token) {
    await discordAlert("webhook_error", {
      source: "assemblyai",
      reason: "bad_token",
      transcriptId: row.id,
    });
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Already terminal — short-circuit; AAI may retry.
  if (row.status === "completed" || row.status === "error") {
    return Response.json({ ok: true, dedup: true });
  }

  const aai = await getTranscript(aaiId);
  await applyAaiResult(env, row, aai);

  return Response.json({ ok: true });
}

type Row = {
  id: string;
  user_id: string;
  webhook_token: string;
  reserved_minutes: number | null;
  processing_limit_sec: number | null;
  submit_started_at: string | null;
  status: string;
};

export async function applyAaiResult(
  env: CloudflareEnv,
  row: Row,
  aai: Awaited<ReturnType<typeof getTranscript>>
): Promise<void> {
  if (aai.status === "completed") {
    const {
      processedDurationSec,
      inferredSourceDurationSec,
      reportedDurationSec,
    } = resolveAaiDuration(aai.audio_duration, row.processing_limit_sec);
    const actualMin = settledTranscriptionMinutes(
      processedDurationSec,
      row.reserved_minutes ?? 0
    );
    if (processedDurationSec === null) {
      console.warn(JSON.stringify({
        event: "aai_audio_duration_missing",
        transcriptId: row.id,
        reservedMin: row.reserved_minutes ?? 0,
      }));
    }
    if (
      reportedDurationSec !== null &&
      inferredSourceDurationSec !== null &&
      processedDurationSec !== reportedDurationSec
    ) {
      console.info(JSON.stringify({
        event: "aai_audio_duration_includes_source",
        transcriptId: row.id,
        reportedDurationSec,
        processingLimitSec: row.processing_limit_sec,
      }));
    }
    const transcriptKey = R2.transcriptKey(row.user_id, row.id);
    const settledModel = aai.speech_model ?? "universal-2";

    // Best-effort enrichment: paragraphs + sentences power the viewer tabs.
    // If AAI hiccups on these endpoints we still ship the core transcript.
    const [paragraphs, sentences] = await Promise.all([
      getParagraphs(aai.id).catch(() => []),
      getSentences(aai.id).catch(() => []),
    ]);
    const enriched = { ...aai, paragraphs, sentences };

    // R2 write first — idempotent on retry (same key, AAI returns same payload).
    // If this throws, status stays non-terminal so AAI webhook retry / inline
    // reconcile will re-attempt instead of stranding a "completed" row with no JSON.
    await env.SCRIBIX_MEDIA.put(transcriptKey, JSON.stringify(enriched), {
      httpMetadata: { contentType: "application/json" },
    });

    // §9.2 atomic guard. Either we win the transition (changes=1) and own
    // quota reconcile, or we lose to a duplicate / inline-reconcile and skip.
    const guard = await env.DB.prepare(
      `UPDATE transcripts
          SET status = 'completed',
              duration_sec = COALESCE(?1, duration_sec),
              source_duration_sec = COALESCE(source_duration_sec, ?2),
              language = ?3,
              transcript_r2_key = ?4,
              speech_model = ?5,
              completed_at = CURRENT_TIMESTAMP
        WHERE id = ?6
          AND status NOT IN ('completed', 'error')`
    )
      .bind(
        processedDurationSec,
        inferredSourceDurationSec,
        aai.language_code ?? null,
        transcriptKey,
        settledModel,
        row.id
      )
      .run();

    if (!guard.meta?.changes) return;

    await reconcileQuota(
      env.DB,
      row.user_id,
      row.reserved_minutes ?? 0,
      actualMin,
      row.submit_started_at
    );
    return;
  }

  if (aai.status === "error") {
    const guard = await env.DB.prepare(
      `UPDATE transcripts
          SET status = 'error', error = ?1, completed_at = CURRENT_TIMESTAMP
        WHERE id = ?2
          AND status NOT IN ('completed', 'error')`
    )
      .bind(aai.error ?? "aai_error", row.id)
      .run();
    if (!guard.meta?.changes) return;
    await reconcileQuota(
      env.DB,
      row.user_id,
      row.reserved_minutes ?? 0,
      0,
      row.submit_started_at
    );
    await discordAlert("transcription_failed", {
      transcriptId: row.id,
      userId: row.user_id,
      error: aai.error ?? "aai_error",
    });
  }
}
