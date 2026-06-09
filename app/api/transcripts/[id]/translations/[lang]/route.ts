import { auth } from "@/auth";
import { translateTranscript, type AaiTranslation } from "@/lib/aai";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { R2 } from "@/lib/r2";

type Params = { params: Promise<{ id: string; lang: string }> };

const ALLOWED_LANGUAGES = new Set([
  "en",
  "zh",
  "es",
  "fr",
  "de",
  "ja",
  "ko",
  "pt",
  "it",
  "nl",
]);

export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId, lang } = await params;
  if (!ALLOWED_LANGUAGES.has(lang)) {
    return Response.json({ error: "unsupported_language" }, { status: 400 });
  }

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const row = await readTranscript(env.DB, transcriptId);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (row.status !== "completed") {
    return Response.json({ error: "not_ready", status: row.status }, { status: 409 });
  }

  const cached = await readCachedTranslation(env, user.id, transcriptId, lang);
  if (cached && cached !== "invalid_cache") return cached;

  const translationRow = await readTranslationRow(env.DB, transcriptId, lang);
  if (translationRow === "missing_table") {
    return Response.json({ error: "translation_store_missing" }, { status: 503 });
  }
  if (translationRow?.status === "processing") {
    return Response.json({ status: "processing" }, { status: 202 });
  }
  if (translationRow?.status === "completed") {
    return Response.json({ error: "translation_missing" }, { status: 410 });
  }
  if (translationRow?.status === "error") {
    return Response.json(
      { error: "translation_failed", detail: translationRow.error },
      { status: 502 }
    );
  }

  return Response.json({ error: "not_found" }, { status: 404 });
}

export async function POST(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId, lang } = await params;
  if (!ALLOWED_LANGUAGES.has(lang)) {
    return Response.json({ error: "unsupported_language" }, { status: 400 });
  }

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
  if (!row.aai_transcript_id) {
    return Response.json({ error: "missing_aai_transcript_id" }, { status: 409 });
  }

  const cached = await readCachedTranslation(env, user.id, transcriptId, lang);
  if (cached && cached !== "invalid_cache") return cached;
  if (cached === "invalid_cache") {
    await env.SCRIBIX_MEDIA.delete(R2.translationKey(user.id, transcriptId, lang)).catch(() => {});
    await runTranslationWrite(
      env.DB,
      `UPDATE transcript_translations
          SET status = 'error',
              r2_key = NULL,
              error = ?1,
              updated_at = CURRENT_TIMESTAMP
        WHERE transcript_id = ?2 AND lang = ?3`,
      ["invalid_cached_translation", transcriptId, lang]
    );
  }

  const inserted = await runTranslationWrite(
    env.DB,
    `INSERT OR IGNORE INTO transcript_translations
       (transcript_id, user_id, lang, status)
     VALUES (?1, ?2, ?3, 'processing')`,
    [transcriptId, user.id, lang]
  );
  if (inserted === "missing_table") {
    return Response.json({ error: "translation_store_missing" }, { status: 503 });
  }

  const shouldGenerate = Boolean(inserted.meta?.changes) || (await claimRetry(env, transcriptId, lang));
  if (!shouldGenerate) {
    const existing = await readTranslationRow(env.DB, transcriptId, lang);
    if (existing === "missing_table") {
      return Response.json({ error: "translation_store_missing" }, { status: 503 });
    }
    if (existing?.status === "completed") {
      const completed = await readCachedTranslation(env, user.id, transcriptId, lang);
      if (completed && completed !== "invalid_cache") return completed;
      return Response.json({ error: "translation_missing" }, { status: 410 });
    }
    if (existing?.status === "error") {
      return Response.json(
        { error: "translation_failed", detail: existing.error },
        { status: 502 }
      );
    }
    return Response.json({ status: "processing" }, { status: 202 });
  }

  const translationKey = R2.translationKey(user.id, transcriptId, lang);
  try {
    const aaiTranslation = await translateTranscript(row.aai_transcript_id, lang);
    const payload = normalizeTranslation({
      aaiTranscriptId: row.aai_transcript_id,
      lang,
      raw: aaiTranslation,
    });
    assertUsableTranslation(payload, aaiTranslation, lang);

    await env.SCRIBIX_MEDIA.put(translationKey, JSON.stringify(payload), {
      httpMetadata: { contentType: "application/json" },
    });

    const completed = await runTranslationWrite(
      env.DB,
      `UPDATE transcript_translations
          SET status = 'completed',
              r2_key = ?1,
              error = NULL,
              updated_at = CURRENT_TIMESTAMP,
              completed_at = CURRENT_TIMESTAMP
        WHERE transcript_id = ?2 AND lang = ?3`,
      [translationKey, transcriptId, lang]
    );
    if (completed === "missing_table") {
      return Response.json({ error: "translation_store_missing" }, { status: 503 });
    }

    return Response.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "translation_failed";
    await runTranslationWrite(
      env.DB,
      `UPDATE transcript_translations
          SET status = 'error',
              error = ?1,
              updated_at = CURRENT_TIMESTAMP
        WHERE transcript_id = ?2 AND lang = ?3`,
      [message.slice(0, 1000), transcriptId, lang]
    );
    return Response.json({ error: "translation_failed" }, { status: 502 });
  }
}

type TranscriptRow = {
  id: string;
  user_id: string;
  status: string;
  aai_transcript_id: string | null;
};

function readTranscript(db: D1Database, transcriptId: string) {
  return db.prepare(
    `SELECT id, user_id, status, aai_transcript_id
       FROM transcripts
      WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<TranscriptRow>();
}

type TranslationRow = {
  status: "processing" | "completed" | "error";
  r2_key: string | null;
  error: string | null;
};

async function readTranslationRow(
  db: D1Database,
  transcriptId: string,
  lang: string
): Promise<TranslationRow | "missing_table" | null> {
  try {
    return await db.prepare(
      `SELECT status, r2_key, error
         FROM transcript_translations
        WHERE transcript_id = ?1 AND lang = ?2`
    )
      .bind(transcriptId, lang)
      .first<TranslationRow>();
  } catch (error) {
    if (isMissingTranslationTable(error)) return "missing_table";
    throw error;
  }
}

async function claimRetry(env: CloudflareEnv, transcriptId: string, lang: string): Promise<boolean> {
  const retry = await runTranslationWrite(
    env.DB,
    `UPDATE transcript_translations
        SET status = 'processing',
            error = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE transcript_id = ?1
        AND lang = ?2
        AND (status = 'error'
          OR (status = 'processing' AND updated_at < datetime('now', '-10 minutes')))`,
    [transcriptId, lang]
  );
  if (retry === "missing_table") return false;
  return Boolean(retry.meta?.changes);
}

async function runTranslationWrite(
  db: D1Database,
  sql: string,
  bindings: unknown[]
): Promise<D1Result | "missing_table"> {
  try {
    return await db.prepare(sql).bind(...bindings).run();
  } catch (error) {
    if (isMissingTranslationTable(error)) return "missing_table";
    throw error;
  }
}

function isMissingTranslationTable(error: unknown): boolean {
  return error instanceof Error && error.message.includes("no such table: transcript_translations");
}

async function readCachedTranslation(
  env: CloudflareEnv,
  userId: string,
  transcriptId: string,
  lang: string
) {
  const obj = await env.SCRIBIX_MEDIA.get(R2.translationKey(userId, transcriptId, lang));
  if (!obj) return null;
  const payload = await obj.json();
  if (!isUsableTranslationPayload(payload)) return "invalid_cache";
  return Response.json(payload);
}

function normalizeTranslation({
  aaiTranscriptId,
  lang,
  raw,
}: {
  aaiTranscriptId: string;
  lang: string;
  raw: AaiTranslation;
}) {
  return {
    lang,
    aaiTranscriptId,
    text: raw.translated_texts?.[lang] ?? "",
    utterances: (raw.utterances ?? [])
      .map((utterance) => ({
        speaker: utterance.speaker ?? null,
        start: utterance.start,
        end: utterance.end,
        text: utterance.translated_texts?.[lang] ?? "",
      }))
      .filter((utterance) => utterance.text.trim().length > 0),
    raw,
    createdAt: new Date().toISOString(),
  };
}

type TranslationPayload = ReturnType<typeof normalizeTranslation>;

function assertUsableTranslation(
  payload: TranslationPayload,
  raw: AaiTranslation,
  lang: string
) {
  const status = raw.speech_understanding?.response?.translation?.status;
  if (status && status !== "success") {
    throw new Error(`AAI translation status was ${status}`);
  }
  if (!isUsableTranslationPayload(payload)) {
    throw new Error(`AAI translation response was empty for ${lang}`);
  }
}

function isUsableTranslationPayload(payload: unknown): payload is TranslationPayload {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as { text?: unknown; utterances?: unknown };
  if (typeof candidate.text === "string" && candidate.text.trim().length > 0) return true;
  if (!Array.isArray(candidate.utterances)) return false;
  return candidate.utterances.some((utterance) => {
    if (!utterance || typeof utterance !== "object") return false;
    const text = (utterance as { text?: unknown }).text;
    return typeof text === "string" && text.trim().length > 0;
  });
}
