import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import {
  authenticateExtensionRequest,
  hasAuthorizationHeader,
} from "@/lib/extension-auth";
import {
  extensionJson,
  extensionOptions,
  isLegacyChromeExtensionOrigin,
} from "@/lib/extension-api";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import {
  OPENAI_SUMMARY_MODEL,
  OpenAISummaryError,
  summarizeTranscriptWithOpenAI,
} from "@/lib/openai-summary";
import { R2 } from "@/lib/r2";
import { youtubeSnippetsToAaiTranscript, type YouTubeCaptionSnippet } from "@/lib/youtube-caption-service";
import { youtubeRequestId } from "@/lib/youtube-route";

type ExtensionSummaryBody = {
  videoId?: unknown;
  languageCode?: unknown;
  snippets?: unknown;
};

export function OPTIONS(req: Request) {
  return extensionOptions(req);
}

export async function POST(req: Request) {
  const env = await cf();
  let user = await authenticateExtensionRequest(env.DB, req);
  if (!user && hasAuthorizationHeader(req)) {
    return extensionJson(req, { error: "unauthorized" }, { status: 401 });
  }
  if (!user && isLegacyChromeExtensionOrigin(req)) {
    const session = await auth();
    user = session ? await getOrCreateCurrentUser(env.DB, session) : null;
  }
  if (!user) return extensionJson(req, { error: "unauthorized" }, { status: 401 });
  if (user.tier === "free") {
    return extensionJson(req, { error: "upgrade_required" }, { status: 402 });
  }

  let body: ExtensionSummaryBody;
  try {
    body = (await req.json()) as ExtensionSummaryBody;
  } catch {
    return extensionJson(req, { error: "invalid_json" }, { status: 400 });
  }

  const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
  const languageCode =
    typeof body.languageCode === "string" && body.languageCode.trim()
      ? body.languageCode.trim().toLowerCase()
      : "en";
  const snippets = sanitizeSnippets(body.snippets);
  if (!videoId || snippets.length === 0) {
    return extensionJson(req, { error: "missing_transcript" }, { status: 400 });
  }

  const requestId = youtubeRequestId();
  const transcriptHash = await hashTranscript(snippets);
  const cacheKey = await sha256(`v1:${user.id}:${videoId}:${languageCode}:${transcriptHash}`);
  const cached = await readExtensionSummaryObject(env, user.id, cacheKey);
  if (cached) return extensionJson(req, { ...cached, cached: true });

  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO extension_youtube_summary_cache
       (cache_key, user_id, video_id, language_code, transcript_hash, status)
     VALUES (?1, ?2, ?3, ?4, ?5, 'processing')`
  )
    .bind(cacheKey, user.id, videoId.slice(0, 100), languageCode.slice(0, 32), transcriptHash)
    .run();

  const shouldGenerate = Boolean(inserted.meta?.changes) || (await claimRetry(env.DB, cacheKey));
  if (!shouldGenerate) {
    const row = await readSummaryCacheRow(env.DB, cacheKey);
    if (row?.status === "completed") {
      const completed = await readExtensionSummaryObject(env, user.id, cacheKey);
      if (completed) return extensionJson(req, { ...completed, cached: true });
      return extensionJson(req, { error: "summary_missing" }, { status: 410 });
    }
    if (row?.status === "error") {
      return extensionJson(req, { error: "summary_failed", requestId }, { status: 502 });
    }
    return extensionJson(req, { status: "processing" }, { status: 202 });
  }

  const summaryKey = R2.extensionYoutubeSummaryKey(user.id, cacheKey);
  try {
    const transcript = youtubeSnippetsToAaiTranscript({
      id: videoId,
      languageCode,
      snippets,
    });
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
    await env.DB.prepare(
      `UPDATE extension_youtube_summary_cache
          SET status = 'completed',
              r2_key = ?1,
              error = NULL,
              updated_at = CURRENT_TIMESTAMP,
              completed_at = CURRENT_TIMESTAMP
        WHERE cache_key = ?2`
    )
      .bind(summaryKey, cacheKey)
      .run();
    return extensionJson(req, { ...payload, cached: false });
  } catch (error) {
    const message =
      error instanceof OpenAISummaryError
        ? `${error.message}${error.status ? `: ${error.status}` : ""}${
            error.details ? ` ${error.details}` : ""
          }`
        : error instanceof Error
          ? error.message
          : "summary_failed";
    await env.DB.prepare(
      `UPDATE extension_youtube_summary_cache
          SET status = 'error',
              error = ?1,
              updated_at = CURRENT_TIMESTAMP
        WHERE cache_key = ?2`
    )
      .bind(message.slice(0, 1000), cacheKey)
      .run();
    const status = error instanceof OpenAISummaryError && error.status ? error.status : 502;
    console.error(`[youtube-extension:${requestId}:summary] failed`, error);
    return extensionJson(req, { error: "summary_failed", requestId }, { status });
  }
}

function sanitizeSnippets(value: unknown): YouTubeCaptionSnippet[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): YouTubeCaptionSnippet | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const text = typeof record.text === "string" ? record.text.trim() : "";
      const startMs = typeof record.startMs === "number" ? record.startMs : Number(record.startMs);
      const endMs = typeof record.endMs === "number" ? record.endMs : Number(record.endMs);
      if (!text || !Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
      return {
        text,
        startMs: Math.max(0, Math.floor(startMs)),
        endMs: Math.max(Math.floor(endMs), Math.floor(startMs) + 1),
      };
    })
    .filter((snippet): snippet is YouTubeCaptionSnippet => snippet !== null)
    .slice(0, 5000);
}

type SummaryCacheRow = {
  status: "processing" | "completed" | "error";
  r2_key: string | null;
  error: string | null;
};

function readSummaryCacheRow(db: D1Database, cacheKey: string): Promise<SummaryCacheRow | null> {
  return db
    .prepare(
      `SELECT status, r2_key, error
         FROM extension_youtube_summary_cache
        WHERE cache_key = ?1`
    )
    .bind(cacheKey)
    .first<SummaryCacheRow>();
}

async function claimRetry(db: D1Database, cacheKey: string): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE extension_youtube_summary_cache
          SET status = 'processing',
              error = NULL,
              updated_at = CURRENT_TIMESTAMP
        WHERE cache_key = ?1
          AND (status = 'error'
            OR (status = 'processing' AND updated_at < datetime('now', '-10 minutes')))`,
    )
    .bind(cacheKey)
    .run();
  return Boolean(result.meta?.changes);
}

async function readExtensionSummaryObject(
  env: CloudflareEnv,
  userId: string,
  cacheKey: string
): Promise<{ summary: string; provider: string; model: string; createdAt?: string } | null> {
  const obj = await env.SCRIBIX_MEDIA.get(R2.extensionYoutubeSummaryKey(userId, cacheKey));
  if (!obj) return null;
  const payload = (await obj.json()) as {
    summary?: unknown;
    provider?: unknown;
    model?: unknown;
    createdAt?: unknown;
  };
  if (typeof payload.summary !== "string" || !payload.summary.trim()) return null;
  return {
    summary: payload.summary,
    provider: typeof payload.provider === "string" ? payload.provider : "openai",
    model: typeof payload.model === "string" ? payload.model : OPENAI_SUMMARY_MODEL,
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : undefined,
  };
}

async function hashTranscript(snippets: YouTubeCaptionSnippet[]): Promise<string> {
  return sha256(
    snippets
      .map((snippet) => `${snippet.startMs}:${snippet.endMs}:${snippet.text.replace(/\s+/g, " ").trim()}`)
      .join("\n")
  );
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
