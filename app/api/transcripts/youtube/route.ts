import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { listYouTubeTranscripts, YouTubeTranscriptError } from "@/lib/youtube-transcripts";
import { reserveYouTubeInspectAttempt } from "@/lib/youtube-inspect-rate-limit";
import { checkYouTubeImportQuota } from "@/lib/youtube-quota";
import { statusForYouTubeTranscriptError, youtubeRequestId } from "@/lib/youtube-route";

export async function POST(req: Request) {
  const requestId = youtubeRequestId();
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string") {
    return Response.json({ error: "missing_url" }, { status: 400 });
  }

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const quota = await checkYouTubeImportQuota(env.DB, user.id);
  if ("error" in quota) {
    if (quota.error === "user_not_found") {
      return Response.json({ error: "user_not_found" }, { status: 404 });
    }
    return Response.json(
      { error: quota.error, cap: quota.cap, remaining: quota.remaining },
      { status: 429 }
    );
  }

  const inspectRateLimit = await reserveYouTubeInspectAttempt(env.DB, user.id);
  if ("error" in inspectRateLimit) {
    console.warn(`[youtube-transcripts:${requestId}:list] rate limited`, {
      userId: user.id,
      limit: inspectRateLimit.limit,
      retryAfterSec: inspectRateLimit.retryAfterSec,
    });
    return Response.json(
      {
        error: inspectRateLimit.error,
        limit: inspectRateLimit.limit,
        retryAfterSec: inspectRateLimit.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(inspectRateLimit.retryAfterSec) },
      }
    );
  }

  try {
    console.warn(`[youtube-transcripts:${requestId}:list] list started`, {
      userId: user.id,
      url: body.url,
    });
    const result = await listYouTubeTranscripts(body.url, {
      requestId,
      route: "list",
    });
    console.warn(`[youtube-transcripts:${requestId}:list] list completed`, {
      videoId: result.videoId,
      trackCount: result.tracks.length,
      tracks: result.tracks,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof YouTubeTranscriptError) {
      console.warn(`[youtube-transcripts:${requestId}:list] list failed`, {
        error: error.code,
      });
      return Response.json(
        { error: error.code },
        { status: statusForYouTubeTranscriptError(error.code) }
      );
    }
    console.error(`[youtube-transcripts:${requestId}:list] list crashed`, error);
    return Response.json({ error: "youtube_fetch_failed" }, { status: 502 });
  }
}
