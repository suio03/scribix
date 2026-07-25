import { auth } from "@/auth";
import type { AaiTranscript } from "@/lib/aai";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import {
  OPENAI_SUMMARY_MODEL,
  OpenAISummaryError,
  summarizeTranscriptWithOpenAI,
} from "@/lib/openai-summary";
import { R2 } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId } = await params;

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  if (user.tier === "free") {
    return Response.json({ error: "upgrade_required" }, { status: 402 });
  }

  const row = await readTranscript(env.DB, transcriptId);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (row.status !== "completed") {
    return Response.json({ error: "not_ready", status: row.status }, { status: 409 });
  }

  const existing = await readSummaryObject(env, user.id, transcriptId);
  if (existing) return existing;

  const summaryRow = await readSummaryRow(env.DB, transcriptId);
  if (summaryRow === "missing_table") {
    return Response.json({ error: "summary_store_missing" }, { status: 503 });
  }
  if (summaryRow?.status === "processing") {
    return Response.json({ status: "processing" }, { status: 202 });
  }
  if (summaryRow?.status === "completed") {
    return Response.json({ error: "summary_missing" }, { status: 410 });
  }
  if (summaryRow?.status === "error") {
    return Response.json({ error: "summary_failed" }, { status: 502 });
  }

  return Response.json({ error: "not_found" }, { status: 404 });
}

export async function POST(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId } = await params;
  const requestId = makeSummaryRequestId();

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  if (user.tier === "free") {
    return Response.json({ error: "upgrade_required" }, { status: 402 });
  }

  const row = await readTranscript(env.DB, transcriptId);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (row.status !== "completed") {
    return Response.json({ error: "not_ready", status: row.status }, { status: 409 });
  }
  if (!row.transcript_r2_key) {
    return Response.json({ error: "missing_transcript" }, { status: 409 });
  }

  const existing = await readSummaryObject(env, user.id, transcriptId);
  if (existing) return existing;

  const inserted = await runSummaryWrite(
    env.DB,
    `INSERT OR IGNORE INTO transcript_summaries
       (transcript_id, user_id, status)
     VALUES (?1, ?2, 'processing')`,
    [transcriptId, user.id]
  );
  if (inserted === "missing_table") {
    return Response.json({ error: "summary_store_missing" }, { status: 503 });
  }

  const shouldGenerate = Boolean(inserted.meta?.changes) || (await claimRetry(env, transcriptId));
  if (!shouldGenerate) {
    const summaryRow = await readSummaryRow(env.DB, transcriptId);
    if (summaryRow === "missing_table") {
      return Response.json({ error: "summary_store_missing" }, { status: 503 });
    }
    if (summaryRow?.status === "completed") {
      const completed = await readSummaryObject(env, user.id, transcriptId);
      if (completed) return completed;
      return Response.json({ error: "summary_missing" }, { status: 410 });
    }
    if (summaryRow?.status === "error") {
      return Response.json({ error: "summary_failed", requestId }, { status: 502 });
    }
    return Response.json({ status: "processing" }, { status: 202 });
  }

  const summaryKey = R2.summaryKey(user.id, transcriptId);
  try {
    logSummary(requestId, "generate start", { transcriptId, userId: user.id });
    const transcript = await readTranscriptObject(env, row.transcript_r2_key);
    if (!transcript) throw new OpenAISummaryError("Transcript object missing");

    const summary = await summarizeTranscriptWithOpenAI(transcript, { requestId });
    const payload = {
      summary,
      provider: "openai",
      model: OPENAI_SUMMARY_MODEL,
      createdAt: new Date().toISOString(),
    };

    await env.SCRIBIX_MEDIA.put(summaryKey, JSON.stringify(payload), {
      httpMetadata: { contentType: "application/json" },
    });

    const completed = await runSummaryWrite(
      env.DB,
      `UPDATE transcript_summaries
          SET status = 'completed',
              r2_key = ?1,
              error = NULL,
              updated_at = CURRENT_TIMESTAMP,
              completed_at = CURRENT_TIMESTAMP
        WHERE transcript_id = ?2`,
      [summaryKey, transcriptId]
    );
    if (completed === "missing_table") {
      return Response.json({ error: "summary_store_missing" }, { status: 503 });
    }

    logSummary(requestId, "generate completed", {
      transcriptId,
      summaryChars: summary.length,
    });
    return Response.json(sanitizeSummaryPayload(payload));
  } catch (error) {
    const message =
      error instanceof OpenAISummaryError
        ? `${error.message}${error.status ? `: ${error.status}` : ""}${
            error.details ? ` ${error.details}` : ""
          }`
        : error instanceof Error
          ? error.message
          : "summary_failed";
    logSummary(requestId, "generate failed", {
      transcriptId,
      error: message.slice(0, 1000),
    });
    await runSummaryWrite(
      env.DB,
      `UPDATE transcript_summaries
          SET status = 'error',
              error = ?1,
              updated_at = CURRENT_TIMESTAMP
        WHERE transcript_id = ?2`,
      [message.slice(0, 1000), transcriptId]
    );
    if (
      error instanceof OpenAISummaryError &&
      (error.status === 401 || error.status === 403 || !process.env.OPENAI_API_KEY)
    ) {
      return Response.json(
        {
          error: "summary_service_unavailable",
          requestId,
        },
        { status: 503 }
      );
    }
    return Response.json(
      {
        error: "summary_failed",
        requestId,
      },
      { status: statusForSummaryError(error) }
    );
  }
}

type TranscriptRow = {
  id: string;
  user_id: string;
  status: string;
  transcript_r2_key: string | null;
};

function readTranscript(db: D1Database, transcriptId: string) {
  return db.prepare(
    `SELECT id, user_id, status, transcript_r2_key
       FROM transcripts
      WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<TranscriptRow>();
}

type SummaryRow = {
  status: "processing" | "completed" | "error";
  r2_key: string | null;
  error: string | null;
};

async function readSummaryRow(
  db: D1Database,
  transcriptId: string
): Promise<SummaryRow | "missing_table" | null> {
  try {
    return await db.prepare(
      `SELECT status, r2_key, error
         FROM transcript_summaries
        WHERE transcript_id = ?1`
    )
      .bind(transcriptId)
      .first<SummaryRow>();
  } catch (error) {
    if (isMissingSummaryTable(error)) return "missing_table";
    throw error;
  }
}

async function claimRetry(env: CloudflareEnv, transcriptId: string): Promise<boolean> {
  const retry = await runSummaryWrite(
    env.DB,
    `UPDATE transcript_summaries
        SET status = 'processing',
            error = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE transcript_id = ?1
        AND (status = 'error'
          OR (status = 'processing' AND updated_at < datetime('now', '-10 minutes')))`,
    [transcriptId]
  );
  if (retry === "missing_table") return false;
  return Boolean(retry.meta?.changes);
}

async function runSummaryWrite(
  db: D1Database,
  sql: string,
  bindings: unknown[]
): Promise<D1Result | "missing_table"> {
  try {
    return await db.prepare(sql).bind(...bindings).run();
  } catch (error) {
    if (isMissingSummaryTable(error)) return "missing_table";
    throw error;
  }
}

function isMissingSummaryTable(error: unknown): boolean {
  return error instanceof Error && error.message.includes("no such table: transcript_summaries");
}

function statusForSummaryError(error: unknown): number {
  if (!(error instanceof OpenAISummaryError)) return 500;
  if (error.status === 429) return 429;
  if (error.status && error.status >= 400 && error.status < 500) return 422;
  return 502;
}

function makeSummaryRequestId(): string {
  return `sum_${Math.random().toString(36).slice(2, 10)}`;
}

function logSummary(
  requestId: string,
  event: string,
  details: Record<string, unknown>
) {
  console.info(`[summary:${requestId}] ${event}`, details);
}

async function readSummaryObject(env: CloudflareEnv, userId: string, transcriptId: string) {
  const obj = await env.SCRIBIX_MEDIA.get(R2.summaryKey(userId, transcriptId));
  if (!obj) return null;
  const payload = await obj.json();
  return Response.json(sanitizeSummaryPayload(payload));
}

function sanitizeSummaryPayload(payload: unknown) {
  const summaryPayload = payload as { summary?: unknown; createdAt?: unknown };
  return {
    summary: typeof summaryPayload.summary === "string" ? summaryPayload.summary : "",
    createdAt:
      typeof summaryPayload.createdAt === "string" ? summaryPayload.createdAt : undefined,
  };
}

async function readTranscriptObject(
  env: CloudflareEnv,
  transcriptKey: string
): Promise<AaiTranscript | null> {
  const obj = await env.SCRIBIX_MEDIA.get(transcriptKey);
  if (!obj) return null;
  return (await obj.json()) as AaiTranscript;
}
