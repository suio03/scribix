import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { newId, newWebhookToken } from "@/lib/ids";
import { youtubeMaxVideoSecFor } from "@/lib/plans";
import { R2 } from "@/lib/r2";
import {
  fetchYouTubeTranscript,
  YouTubeTranscriptError,
  youtubeSnippetsToAaiTranscript,
} from "@/lib/youtube-transcripts";
import { refundYouTubeImport, reserveYouTubeImport } from "@/lib/youtube-quota";
import { statusForYouTubeTranscriptError, youtubeRequestId } from "@/lib/youtube-route";

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
  let quotaReserved = false;

  try {
    console.warn(`[youtube-transcripts:${requestId}:import] import started`, {
      userId: user.id,
      trackId: body.trackId,
      url: body.url,
    });
    const imported = await fetchYouTubeTranscript(body.url, body.trackId, {
      requestId,
      route: "import",
    });
    const maxDurationSec = youtubeMaxVideoSecFor(user.tier);
    if (imported.durationSec > maxDurationSec) {
      console.warn(`[youtube-transcripts:${requestId}:import] duration rejected`, {
        userId: user.id,
        tier: user.tier,
        durationSec: imported.durationSec,
        maxDurationSec,
      });
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

    const quota = await reserveYouTubeImport(env.DB, user.id);
    if ("error" in quota) {
      if (quota.error === "user_not_found") {
        return Response.json({ error: "user_not_found" }, { status: 404 });
      }
      return Response.json(
        { error: quota.error, cap: quota.cap, remaining: quota.remaining },
        { status: 429 }
      );
    }
    quotaReserved = true;

    const transcriptId = newId();
    const transcriptKey = R2.transcriptKey(user.id, transcriptId);
    const durationSec = imported.durationSec;
    const aai = youtubeSnippetsToAaiTranscript({
      id: transcriptId,
      languageCode: imported.track.languageCode,
      snippets: imported.snippets,
    });

    await env.SCRIBIX_MEDIA.put(transcriptKey, JSON.stringify(aai), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

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
        durationSec,
        imported.track.languageCode,
        newWebhookToken(),
        body.url.trim(),
        imported.videoId,
        imported.track.languageCode,
        imported.track.isGenerated ? "asr" : "manual"
      )
      .run();

    console.warn(`[youtube-transcripts:${requestId}:import] import completed`, {
      transcriptId,
      videoId: imported.videoId,
      snippetCount: imported.snippets.length,
      durationSec,
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
    if (quotaReserved) {
      await refundYouTubeImport(env.DB, user.id);
    }
    if (error instanceof YouTubeTranscriptError) {
      console.warn(`[youtube-transcripts:${requestId}:import] import failed`, {
        error: error.code,
        trackId: body.trackId,
      });
      return Response.json(
        { error: error.code },
        { status: statusForYouTubeTranscriptError(error.code) }
      );
    }
    console.error(`[youtube-transcripts:${requestId}:import] import crashed`, error);
    return Response.json({ error: "youtube_fetch_failed" }, { status: 502 });
  }
}

function sanitizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, 200) || "YouTube transcript";
}
