import { cf } from "@/lib/cf";
import { extensionJson, extensionOptions } from "@/lib/extension-api";
import {
  importYouTubeCaptions,
  inspectYouTubeCaptions,
  YouTubeCaptionServiceError,
  type YouTubeCaptionTrack,
} from "@/lib/youtube-caption-service";
import {
  refundExtensionYouTubeClientImport,
  refundExtensionYouTubeIpImport,
  reserveExtensionYouTubeClientImport,
  reserveExtensionYouTubeIpImport,
} from "@/lib/youtube-extension-quota";
import { statusForYouTubeCaptionError, youtubeRequestId } from "@/lib/youtube-route";

const EXTENSION_MAX_YOUTUBE_VIDEO_SEC = 2 * 3600;

type YouTubeServiceEnv = {
  YOUTUBE_CAPTION_SERVICE_URL?: string;
  YOUTUBE_CAPTION_SERVICE_TOKEN?: string;
};

type ExtensionTranscriptBody = {
  url?: unknown;
  clientId?: unknown;
  languages?: unknown;
};

export function OPTIONS(req: Request) {
  return extensionOptions(req);
}

export async function POST(req: Request) {
  const requestId = youtubeRequestId();
  let body: ExtensionTranscriptBody;
  try {
    body = (await req.json()) as ExtensionTranscriptBody;
  } catch {
    return extensionJson(req, { error: "invalid_json" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!url) return extensionJson(req, { error: "missing_url" }, { status: 400 });
  if (!clientId) return extensionJson(req, { error: "missing_client_id" }, { status: 400 });

  const env = await cf();

  let ipQuotaReserved = false;
  let clientQuotaReserved = false;
  const refundReservedQuota = async () => {
    const refunds: Promise<void>[] = [];
    if (ipQuotaReserved) refunds.push(refundExtensionYouTubeIpImport(env.DB, req, clientId));
    if (clientQuotaReserved) refunds.push(refundExtensionYouTubeClientImport(env.DB, clientId));
    ipQuotaReserved = false;
    clientQuotaReserved = false;
    await Promise.allSettled(refunds);
  };

  const ipQuota = await reserveExtensionYouTubeIpImport(env.DB, req, clientId);
  if ("error" in ipQuota) {
    return extensionJson(
      req,
      { error: ipQuota.error, cap: ipQuota.cap, remaining: ipQuota.remaining },
      { status: 429 }
    );
  }
  ipQuotaReserved = true;

  const clientQuota = await reserveExtensionYouTubeClientImport(env.DB, clientId);
  if ("error" in clientQuota) {
    await refundReservedQuota();
    return extensionJson(
      req,
      { error: clientQuota.error, cap: clientQuota.cap, remaining: clientQuota.remaining },
      { status: 429 }
    );
  }
  clientQuotaReserved = true;

  const languages = Array.isArray(body.languages)
    ? body.languages.filter((value): value is string => typeof value === "string")
    : [];

  try {
    const inspect = await inspectYouTubeCaptions(url, {
      requestId,
      route: "list",
      env: env as YouTubeServiceEnv,
    });
    if (inspect.tracks.length === 0) {
      await refundReservedQuota();
      return extensionJson(req, { error: "transcripts_unavailable" }, { status: 404 });
    }

    const track = preferredTrack(inspect.tracks, languages);
    const imported = await importYouTubeCaptions(url, track.id, {
      requestId,
      route: "import",
      env: env as YouTubeServiceEnv,
    });
    if (imported.durationSec > EXTENSION_MAX_YOUTUBE_VIDEO_SEC) {
      await refundReservedQuota();
      return extensionJson(
        req,
        {
          error: "youtube_duration_exceeds_tier",
          maxSec: EXTENSION_MAX_YOUTUBE_VIDEO_SEC,
          durationSec: imported.durationSec,
        },
        { status: 413 }
      );
    }

    return extensionJson(req, {
      videoId: imported.videoId,
      title: imported.title,
      durationSec: imported.durationSec,
      track: imported.track,
      snippets: imported.snippets,
      text: imported.snippets.map((snippet) => snippet.text).join("\n"),
      quota: { remaining: Math.min(clientQuota.remaining, ipQuota.remaining), cap: clientQuota.cap },
    });
  } catch (error) {
    await refundReservedQuota();
    if (error instanceof YouTubeCaptionServiceError) {
      return extensionJson(
        req,
        { error: error.code },
        { status: statusForYouTubeCaptionError(error.code) }
      );
    }
    console.error(`[youtube-extension:${requestId}:transcript] crashed`, error);
    return extensionJson(req, { error: "youtube_fetch_failed" }, { status: 502 });
  }
}

function preferredTrack(tracks: YouTubeCaptionTrack[], languages: string[]): YouTubeCaptionTrack {
  const normalized = languages.map(normalizeLanguage).filter(Boolean);
  for (const language of normalized) {
    const exact = tracks.find((track) => normalizeLanguage(track.languageCode) === language);
    if (exact) return exact;
  }
  for (const language of normalized) {
    const base = language.split("-")[0];
    const match = tracks.find((track) => normalizeLanguage(track.languageCode).split("-")[0] === base);
    if (match) return match;
  }
  return (
    tracks.find((track) => normalizeLanguage(track.languageCode).startsWith("en")) ??
    tracks.find((track) => !track.isGenerated) ??
    tracks[0]
  );
}

function normalizeLanguage(value: string): string {
  return value.trim().toLowerCase().replace("_", "-");
}
