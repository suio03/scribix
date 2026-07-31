import { auth } from "@/auth";
import type { AaiTranscript } from "@/lib/aai";
import { prepareAiUsageEvent, type AiTokenUsage } from "@/lib/ai-usage";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser, type CurrentUserRow } from "@/lib/current-user";
import {
  OPENAI_CHAT_MODEL,
  OpenAIChatError,
  askTranscriptWithOpenAI,
  type AskTranscriptResult,
  type ChatHistoryMessage,
} from "@/lib/openai-chat";
import {
  AI_CHAT_HISTORY_PAGE_SIZE,
  AI_CHAT_QUESTION_CHAR_LIMIT,
  aiQuestionsFor,
} from "@/lib/plans";
import { allowancePeriodEndsAt } from "@/lib/quota-period";

type Params = { params: Promise<{ id: string }> };

type TranscriptRow = {
  id: string;
  user_id: string;
  status: string;
  transcript_r2_key: string | null;
};

type ChatMessageRow = ChatHistoryMessage & {
  id: number;
  created_at: string;
};

const MODEL_HISTORY_READ_LIMIT = 41;

export async function GET(_: Request, { params }: Params) {
  const context = await readChatContext(params);
  if (context instanceof Response) return context;
  const { env, transcriptId, user } = context;

  const { results } = await env.DB.prepare(
    `SELECT id, role, content, created_at
       FROM (
         SELECT id, role, content, created_at
           FROM ai_chat_messages
          WHERE transcript_id = ?1
            AND user_id = ?2
          ORDER BY id DESC
          LIMIT ?3
       )
      ORDER BY id ASC`
  )
    .bind(transcriptId, user.id, AI_CHAT_HISTORY_PAGE_SIZE + 1)
    .all<ChatMessageRow>();

  const hasOlder = results.length > AI_CHAT_HISTORY_PAGE_SIZE;
  const messages = hasOlder ? results.slice(1) : results;
  const cap = aiQuestionsFor(user.tier, user.billing_cycle);
  return Response.json({
    messages: messages.map(toChatMessage),
    hasOlder,
    used: usedQuestionsFor(user),
    cap,
    resetAt: user.tier === "pro" ? allowancePeriodEndsAt(user) : null,
  });
}

export async function POST(req: Request, { params }: Params) {
  const context = await readChatContext(params);
  if (context instanceof Response) return context;
  const { env, row, transcriptId, user } = context;

  const question = await readQuestion(req);
  if (question instanceof Response) return question;

  const cap = aiQuestionsFor(user.tier, user.billing_cycle);
  if (usedQuestionsFor(user) >= cap) {
    return quotaExceededResponse(user, cap);
  }

  const [transcriptObject, historyResult, promptCacheKey] = await Promise.all([
    env.SCRIBIX_MEDIA.get(row.transcript_r2_key!),
    env.DB.prepare(
      `SELECT id, role, content, created_at
         FROM ai_chat_messages
        WHERE transcript_id = ?1
          AND user_id = ?2
        ORDER BY id DESC
        LIMIT ?3`
    )
      .bind(transcriptId, user.id, MODEL_HISTORY_READ_LIMIT)
      .all<ChatMessageRow>(),
    promptCacheKeyForTranscript(transcriptId),
  ]);
  if (!transcriptObject) {
    return Response.json({ error: "transcript_missing" }, { status: 410 });
  }

  let transcript: AaiTranscript;
  try {
    transcript = (await transcriptObject.json()) as AaiTranscript;
  } catch {
    return Response.json({ error: "transcript_missing" }, { status: 410 });
  }

  const reserved = await reserveQuestion(env.DB, user, cap);

  if (!reserved.meta?.changes) {
    return quotaExceededResponse(user, cap);
  }

  const requestId = makeChatRequestId();
  let completedResult: AskTranscriptResult | null = null;
  try {
    const history = historyResult.results
      .slice()
      .reverse()
      .map(({ role, content }) => ({ role, content }));
    const result = await askTranscriptWithOpenAI(
      transcript,
      history,
      question,
      { requestId, promptCacheKey }
    );
    completedResult = result;

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO ai_chat_messages (transcript_id, user_id, role, content)
         VALUES (?1, ?2, 'user', ?3)`
      ).bind(transcriptId, user.id, question),
      env.DB.prepare(
        `INSERT INTO ai_chat_messages (transcript_id, user_id, role, content)
         VALUES (?1, ?2, 'assistant', ?3)`
      ).bind(transcriptId, user.id, result.answer),
    ]);

    await recordAiUsageBestEffort({
      db: env.DB,
      requestStatus: "success",
      requestId,
      providerResponseId: result.responseId,
      serviceTier: result.serviceTier,
      user,
      transcriptId,
      usage: result.usage,
    });

    const used = usedQuestionsFor(user) + 1;
    return Response.json({
      answer: result.answer,
      answerTruncated: result.answerTruncated,
      used,
      cap,
      remaining: Math.max(0, cap - used),
      resetAt: user.tier === "pro" ? allowancePeriodEndsAt(user) : null,
      transcriptTruncated: result.transcriptTruncated,
      historyTruncated: result.historyTruncated,
    });
  } catch (error) {
    const providerError = error instanceof OpenAIChatError ? error : null;
    const usage = providerError?.usage ?? completedResult?.usage;
    const errorCode =
      providerError?.providerCode ??
      (completedResult
        ? "persistence_failed"
        : error instanceof Error
          ? error.name
          : "unknown");
    const usageRecorded = await recordAiUsageBestEffort({
      db: env.DB,
      requestStatus: "failed",
      requestId,
      providerResponseId:
        providerError?.responseId ?? completedResult?.responseId,
      providerErrorCode: errorCode,
      serviceTier:
        providerError?.serviceTier ?? completedResult?.serviceTier,
      user,
      transcriptId,
      usage,
    });

    try {
      await refundQuestion(env.DB, user);
    } catch {
      console.error(JSON.stringify({
        event: "ai_chat_quota_refund_failed",
        requestId,
        transcriptId,
        userId: user.id,
      }));
    }
    console.info(JSON.stringify({
      event: "ai_chat_failed",
      requestId,
      transcriptId,
      providerResponseId:
        providerError?.responseId ?? completedResult?.responseId,
      modelStatus: providerError?.status,
      errorCode,
      usageRecorded,
    }));
    return Response.json(
      { error: "ai_provider_unavailable", requestId },
      { status: 502 }
    );
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const context = await readChatContext(params);
  if (context instanceof Response) return context;
  const { env, transcriptId, user } = context;

  await env.DB.prepare(
    `DELETE FROM ai_chat_messages
      WHERE transcript_id = ?1
        AND user_id = ?2`
  )
    .bind(transcriptId, user.id)
    .run();

  return Response.json({ ok: true });
}

async function readChatContext(params: Params["params"]): Promise<
  | {
      env: CloudflareEnv;
      row: TranscriptRow;
      transcriptId: string;
      user: CurrentUserRow;
    }
  | Response
> {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId } = await params;

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const row = await env.DB.prepare(
    `SELECT id, user_id, status, transcript_r2_key
       FROM transcripts
      WHERE id = ?1
        AND deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<TranscriptRow>();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (row.status !== "completed") {
    return Response.json(
      { error: "not_ready", status: row.status },
      { status: 409 }
    );
  }
  if (!row.transcript_r2_key) {
    return Response.json({ error: "transcript_missing" }, { status: 410 });
  }

  return { env, row, transcriptId, user };
}

async function readQuestion(req: Request): Promise<string | Response> {
  let body: { question?: unknown };
  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.question !== "string" || !body.question.trim()) {
    return Response.json({ error: "invalid_question" }, { status: 400 });
  }
  const question = body.question.trim();
  if (question.length > AI_CHAT_QUESTION_CHAR_LIMIT) {
    return Response.json(
      {
        error: "message_too_long",
        maxChars: AI_CHAT_QUESTION_CHAR_LIMIT,
      },
      { status: 400 }
    );
  }
  return question;
}

async function refundQuestion(
  db: D1Database,
  user: CurrentUserRow
): Promise<void> {
  if (user.tier !== "pro") {
    await db.prepare(
      `UPDATE users
          SET ai_free_questions_used = MAX(0, ai_free_questions_used - 1)
        WHERE id = ?1
          AND deleted_at IS NULL`
    )
      .bind(user.id)
      .run();
    return;
  }

  await db.prepare(
    `UPDATE users
        SET ai_questions_used_this_period =
          MAX(0, ai_questions_used_this_period - 1)
      WHERE id = ?1
        AND deleted_at IS NULL
        AND period_started_at = ?2`
  )
    .bind(user.id, user.period_started_at)
    .run();
}

async function reserveQuestion(
  db: D1Database,
  user: CurrentUserRow,
  cap: number
) {
  if (user.tier !== "pro") {
    return db.prepare(
      `UPDATE users
          SET ai_free_questions_used = ai_free_questions_used + 1
        WHERE id = ?1
          AND deleted_at IS NULL
          AND tier IN ('free', 'basic')
          AND ai_free_questions_used + 1 <= ?2`
    )
      .bind(user.id, cap)
      .run();
  }

  return db.prepare(
    `UPDATE users
        SET ai_questions_used_this_period = ai_questions_used_this_period + 1
      WHERE id = ?1
        AND deleted_at IS NULL
        AND tier = 'pro'
        AND ai_questions_used_this_period + 1 <= ?2`
  )
    .bind(user.id, cap)
    .run();
}

function usedQuestionsFor(user: CurrentUserRow): number {
  return user.tier === "pro"
    ? user.ai_questions_used_this_period
    : user.ai_free_questions_used;
}

function toChatMessage(row: ChatMessageRow) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

function makeChatRequestId(): string {
  return `chat_${Math.random().toString(36).slice(2, 10)}`;
}

function quotaExceededResponse(user: CurrentUserRow, cap: number): Response {
  return Response.json(
    {
      error: "ai_quota_exceeded",
      cap,
      remaining: 0,
      resetAt: user.tier === "pro" ? allowancePeriodEndsAt(user) : null,
    },
    { status: 402 }
  );
}

async function promptCacheKeyForTranscript(
  transcriptId: string
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(transcriptId)
  );
  const shortDigest = Array.from(new Uint8Array(digest).slice(0, 24))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `chat:${shortDigest}`;
}

async function recordAiUsageBestEffort({
  db,
  requestStatus,
  requestId,
  providerResponseId,
  providerErrorCode,
  serviceTier,
  user,
  transcriptId,
  usage,
}: {
  db: D1Database;
  requestStatus: "success" | "failed";
  requestId: string;
  providerResponseId?: string | null;
  providerErrorCode?: string | null;
  serviceTier?: string | null;
  user: CurrentUserRow;
  transcriptId: string;
  usage?: AiTokenUsage | null;
}): Promise<boolean> {
  if (!usage) {
    if (requestStatus === "success") {
      console.warn(JSON.stringify({
        event: "ai_usage_missing",
        feature: "transcript_chat",
        requestId,
        providerResponseId,
        model: OPENAI_CHAT_MODEL,
      }));
    }
    return false;
  }

  try {
    await prepareAiUsageEvent(db, {
      feature: "transcript_chat",
      requestStatus,
      requestId,
      providerResponseId,
      providerErrorCode,
      model: OPENAI_CHAT_MODEL,
      serviceTier,
      userId: user.id,
      transcriptId,
      planTier: user.tier,
      billingCycle: user.billing_cycle,
      usage,
    }).run();
    return true;
  } catch (error) {
    console.error(JSON.stringify({
      event: "ai_usage_write_failed",
      feature: "transcript_chat",
      requestId,
      requestStatus,
      error: error instanceof Error ? error.name : "unknown",
      errorMessage:
        error instanceof Error ? error.message.slice(0, 200) : undefined,
    }));
    return false;
  }
}
