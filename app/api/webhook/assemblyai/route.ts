import { getTranscript } from "@/lib/aai";
import { applyAaiResult, type AaiResultRow } from "@/lib/aai-result";
import { cf } from "@/lib/cf";
import { discordAlert } from "@/lib/discord";

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
    .first<AaiResultRow>();
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
      .first<AaiResultRow>();
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
          .first<AaiResultRow>();
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
