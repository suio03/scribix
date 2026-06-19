import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { newId, newWebhookToken } from "@/lib/ids";
import { youtubeMaxVideoSecFor } from "@/lib/plans";
import { R2 } from "@/lib/r2";
import {
  importYouTubeCaptions,
  YouTubeCaptionServiceError,
  youtubeSnippetsToAaiTranscript,
} from "@/lib/youtube-caption-service";
import { reserveYouTubeInspectAttempt } from "@/lib/youtube-inspect-rate-limit";
import {
  refundYouTubeImport,
  reserveYouTubeImport,
} from "@/lib/youtube-quota";
import { statusForYouTubeCaptionError, youtubeRequestId } from "@/lib/youtube-route";

type YouTubeServiceEnv = {
  YOUTUBE_CAPTION_SERVICE_URL?: string;
  YOUTUBE_CAPTION_SERVICE_TOKEN?: string;
};

export async function POST(req: Request) {
  const requestId = youtubeRequestId();
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { url?: string; trackId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string") {
    return Response.json({ error: "missing_url" }, { status: 400 });
  }
  if (!body.trackId || typeof body.trackId !== "string") {
    return Response.json({ error: "missing_track" }, { status: 400 });
  }

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const importRateLimit = await reserveYouTubeInspectAttempt(env.DB, user.id);
  if ("error" in importRateLimit) {
    console.warn(`[youtube-captions:${requestId}:import] rate limited`, {
      userId: user.id,
      limit: importRateLimit.limit,
      retryAfterSec: importRateLimit.retryAfterSec,
    });
    return Response.json(
      {
        error: importRateLimit.error,
        limit: importRateLimit.limit,
        retryAfterSec: importRateLimit.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(importRateLimit.retryAfterSec) },
      }
    );
  }

  const quota = await reserveYouTubeImport(env.DB, user.id);
  if ("error" in quota) {
    if (quota.error === "user_not_found") {
      return Response.json({ error: "user_not_found" }, { status: 404 });
    }
    return Response.json(
      {
        error: quota.error,
        cap: quota.cap,
        remaining: quota.remaining,
      },
      { status: 429 }
    );
  }

  let quotaReserved = true;
  let transcriptKeyToCleanup: string | null = null;

  try {
    console.warn(`[youtube-captions:${requestId}:import] import started`, {
      userId: user.id,
      trackId: body.trackId,
      url: body.url,
    });
    const imported = await importYouTubeCaptions(body.url, body.trackId, {
      requestId,
      route: "import",
      env: env as YouTubeServiceEnv,
    });
    const maxDurationSec = youtubeMaxVideoSecFor(user.tier);
    if (imported.durationSec > maxDurationSec) {
      console.warn(`[youtube-captions:${requestId}:import] duration rejected`, {
        userId: user.id,
        tier: user.tier,
        durationSec: imported.durationSec,
        maxDurationSec,
      });
      await refundYouTubeImport(env.DB, user.id);
      quotaReserved = false;
      return Response.json(
        {
          error: "youtube_duration_exceeds_tier",
          maxSec: maxDurationSec,
          durationSec: imported.durationSec,
          tier: user.tier,
        },
        { status: 413 }
      );
    }

    const transcriptId = newId();
    const transcriptKey = R2.transcriptKey(user.id, transcriptId);
    const aai = youtubeSnippetsToAaiTranscript({
      id: transcriptId,
      languageCode: imported.track.languageCode,
      snippets: imported.snippets,
    });

    await env.SCRIBIX_MEDIA.put(transcriptKey, JSON.stringify(aai), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
    transcriptKeyToCleanup = transcriptKey;

    await env.DB.prepare(
      `INSERT INTO transcripts
         (id, user_id, title, status, source, transcript_r2_key, filename,
          mime_type, bytes, duration_sec, reserved_minutes, speech_model,
          language, webhook_token, completed_at, youtube_url, youtube_video_id,
          youtube_track_language, youtube_track_kind)
       VALUES (?1, ?2, ?3, 'completed', 'youtube', ?4, ?5,
          'text/youtube-captions', ?6, ?7, 0, 'youtube-captions',
          ?8, ?9, CURRENT_TIMESTAMP, ?10, ?11, ?12, ?13)`
    )
      .bind(
        transcriptId,
        user.id,
        sanitizeTitle(imported.title),
        transcriptKey,
        `youtube-${imported.videoId}.txt`,
        new TextEncoder().encode(aai.text ?? "").byteLength,
        imported.durationSec,
        imported.track.languageCode,
        newWebhookToken(),
        canonicalYouTubeUrl(imported.videoId),
        imported.videoId,
        imported.track.languageCode,
        imported.track.isGenerated ? "asr" : "manual"
      )
      .run();
    transcriptKeyToCleanup = null;

    console.warn(`[youtube-captions:${requestId}:import] import completed`, {
      transcriptId,
      videoId: imported.videoId,
      snippetCount: imported.snippets.length,
      durationSec: imported.durationSec,
      languageCode: imported.track.languageCode,
      youtubeImportsRemaining: quota.remaining,
    });
    return Response.json({
      transcriptId,
      status: "completed",
      youtubeImportsRemaining: quota.remaining,
      youtubeImportsCap: quota.cap,
    });
  } catch (error) {
    if (transcriptKeyToCleanup) {
      try {
        await env.SCRIBIX_MEDIA.delete(transcriptKeyToCleanup);
      } catch (cleanupError) {
        console.error(
          `[youtube-captions:${requestId}:import] failed to clean transcript object`,
          cleanupError
        );
      }
    }
    if (quotaReserved) {
      await refundYouTubeImport(env.DB, user.id);
    }
    if (error instanceof YouTubeCaptionServiceError) {
      console.warn(`[youtube-captions:${requestId}:import] import failed`, {
        error: error.code,
        trackId: body.trackId,
      });
      return Response.json(
        { error: error.code },
        { status: statusForYouTubeCaptionError(error.code) }
      );
    }
    console.error(`[youtube-captions:${requestId}:import] import crashed`, error);
    return Response.json({ error: "youtube_fetch_failed" }, { status: 502 });
  }
}

function sanitizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, 200) || "YouTube transcript";
}

function canonicalYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}
