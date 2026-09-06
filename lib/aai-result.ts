import { getParagraphs, getSentences, type getTranscript } from "@/lib/aai";
import { resolveAaiDuration } from "@/lib/aai-duration";
import { discordAlert } from "@/lib/discord";
import { reconcileQuota, settledTranscriptionMinutes } from "@/lib/quota";
import { R2 } from "@/lib/r2";

export type AaiResultRow = {
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
  row: AaiResultRow,
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
