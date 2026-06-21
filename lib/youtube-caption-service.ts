import type { AaiSegment, AaiTranscript } from "@/lib/aai";

export type YouTubeCaptionTrack = {
  id: string;
  languageCode: string;
  languageName: string;
  isGenerated: boolean;
  isTranslatable: boolean;
};

export type YouTubeCaptionInspectResult = {
  videoId: string;
  title: string;
  durationSec: number | null;
  tracks: YouTubeCaptionTrack[];
};

export type YouTubeCaptionSnippet = {
  text: string;
  startMs: number;
  endMs: number;
};

export type YouTubeCaptionImportResult = {
  videoId: string;
  title: string;
  durationSec: number;
  track: YouTubeCaptionTrack;
  snippets: YouTubeCaptionSnippet[];
};

export type YouTubeCaptionServiceErrorCode =
  | "invalid_youtube_url"
  | "youtube_fetch_failed"
  | "transcripts_unavailable"
  | "video_unplayable"
  | "track_not_found"
  | "empty_transcript"
  | "missing_youtube_service_config";

type ServiceEnv = {
  YOUTUBE_CAPTION_SERVICE_URL?: string;
  YOUTUBE_CAPTION_SERVICE_TOKEN?: string;
};

type YouTubeCaptionServiceOptions = {
  requestId: string;
  route: "list" | "import";
  env?: ServiceEnv;
};

type ServiceTrack = {
  id?: unknown;
  languageCode?: unknown;
  languageName?: unknown;
  isGenerated?: unknown;
  isTranslatable?: unknown;
};

type ServiceInspectResponse = {
  videoId?: unknown;
  title?: unknown;
  durationSec?: unknown;
  tracks?: unknown;
};

type ServiceSnippet = {
  text?: unknown;
  startMs?: unknown;
  endMs?: unknown;
};

type ServiceImportResponse = {
  videoId?: unknown;
  title?: unknown;
  languageCode?: unknown;
  snippets?: unknown;
};

const YOUTUBE_CAPTION_RETRY_DELAYS_MS = [600, 1500] as const;
const YOUTUBE_CAPTION_RETRY_STATUSES = new Set([502, 503, 504]);

export class YouTubeCaptionServiceError extends Error {
  constructor(
    readonly code: YouTubeCaptionServiceErrorCode,
    message = code
  ) {
    super(message);
    this.name = "YouTubeCaptionServiceError";
  }
}

export async function inspectYouTubeCaptions(
  url: string,
  options: YouTubeCaptionServiceOptions
): Promise<YouTubeCaptionInspectResult> {
  const json = await callYouTubeCaptionService<ServiceInspectResponse>(
    "/youtube/inspect",
    { url },
    options
  );
  const videoId = stringFromUnknown(json.videoId);
  if (!videoId) throw new YouTubeCaptionServiceError("youtube_fetch_failed");

  const tracks = Array.isArray(json.tracks)
    ? json.tracks.map(normalizeTrack).filter((track): track is YouTubeCaptionTrack => track !== null)
    : [];

  return {
    videoId,
    title: stringFromUnknown(json.title) || `YouTube ${videoId}`,
    durationSec: numberFromUnknown(json.durationSec),
    tracks,
  };
}

export async function importYouTubeCaptions(
  url: string,
  trackId: string,
  options: YouTubeCaptionServiceOptions
): Promise<YouTubeCaptionImportResult> {
  const json = await callYouTubeCaptionService<ServiceImportResponse>(
    "/youtube/import",
    { url, trackId },
    options
  );
  const videoId = stringFromUnknown(json.videoId);
  const languageCode = stringFromUnknown(json.languageCode);
  if (!videoId || !languageCode) throw new YouTubeCaptionServiceError("youtube_fetch_failed");

  const snippets = Array.isArray(json.snippets)
    ? json.snippets
        .map(normalizeSnippet)
        .filter((snippet): snippet is YouTubeCaptionSnippet => snippet !== null)
    : [];
  if (snippets.length === 0) throw new YouTubeCaptionServiceError("empty_transcript");

  const track = trackFromId(trackId, languageCode);
  return {
    videoId,
    title: stringFromUnknown(json.title) || `YouTube ${videoId}`,
    durationSec: youtubeDurationSec(snippets),
    track,
    snippets,
  };
}

export function youtubeSnippetsToAaiTranscript({
  id,
  languageCode,
  snippets,
}: {
  id: string;
  languageCode: string;
  snippets: YouTubeCaptionSnippet[];
}): AaiTranscript {
  const segments: AaiSegment[] = snippets.map((snippet) => ({
    text: snippet.text,
    start: snippet.startMs,
    end: Math.max(snippet.endMs, snippet.startMs + 1),
  }));

  return {
    id,
    status: "completed",
    language_code: languageCode,
    text: segments.map((segment) => segment.text).join("\n"),
    paragraphs: segments,
    sentences: segments,
  };
}

function youtubeDurationSec(snippets: YouTubeCaptionSnippet[]): number {
  const endMs = snippets.reduce((max, snippet) => Math.max(max, snippet.endMs), 0);
  return Math.max(1, Math.ceil(endMs / 1000));
}

async function callYouTubeCaptionService<T>(
  pathname: string,
  body: unknown,
  options: YouTubeCaptionServiceOptions
): Promise<T> {
  const config = youtubeServiceConfig(options.env);
  const url = new URL(pathname, config.url);
  const serializedBody = JSON.stringify(body);
  const maxAttempts = YOUTUBE_CAPTION_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    logYouTube(options, "service request started", { pathname, attempt, maxAttempts });

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.token}`,
          "content-type": "application/json",
          "x-scribix-request-id": options.requestId,
        },
        body: serializedBody,
      });
    } catch (error) {
      const retryDelayMs = retryDelayForAttempt(attempt);
      logYouTube(options, "service request failed", {
        pathname,
        attempt,
        maxAttempts,
        retrying: retryDelayMs !== null,
        error: error instanceof Error ? error.message : String(error),
      });
      if (retryDelayMs !== null) {
        await delay(retryDelayMs);
        continue;
      }
      throw new YouTubeCaptionServiceError("youtube_fetch_failed");
    }

    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    logYouTube(options, "service response received", {
      pathname,
      attempt,
      maxAttempts,
      status: response.status,
      ok: response.ok,
    });

    if (response.ok) {
      if (!isRecord(json)) throw new YouTubeCaptionServiceError("youtube_fetch_failed");
      return json as T;
    }

    const serviceError = serviceErrorCode(json);
    const retryDelayMs = shouldRetryServiceResponse(response.status, serviceError)
      ? retryDelayForAttempt(attempt)
      : null;
    if (retryDelayMs !== null) {
      logYouTube(options, "service response retry scheduled", {
        pathname,
        attempt,
        maxAttempts,
        status: response.status,
        serviceError,
        retryDelayMs,
      });
      await delay(retryDelayMs);
      continue;
    }

    const code = mapServiceError(json);
    logYouTubeServiceErrorResponse(options, {
      pathname,
      attempt,
      maxAttempts,
      status: response.status,
      contentType: response.headers.get("content-type"),
      mappedError: code,
      serviceError,
      responseBody: summarizeServiceResponse(text),
    });
    throw new YouTubeCaptionServiceError(code);
  }

  throw new YouTubeCaptionServiceError("youtube_fetch_failed");
}

function youtubeServiceConfig(env: ServiceEnv | undefined): { url: URL; token: string } {
  const url =
    env?.YOUTUBE_CAPTION_SERVICE_URL?.trim() ||
    process.env.YOUTUBE_CAPTION_SERVICE_URL?.trim();
  const token =
    env?.YOUTUBE_CAPTION_SERVICE_TOKEN?.trim() ||
    process.env.YOUTUBE_CAPTION_SERVICE_TOKEN?.trim();
  if (!url || !token) {
    throw new YouTubeCaptionServiceError("missing_youtube_service_config");
  }

  try {
    return { url: new URL(url), token };
  } catch {
    throw new YouTubeCaptionServiceError("missing_youtube_service_config");
  }
}

function mapServiceError(json: unknown): YouTubeCaptionServiceErrorCode {
  const raw = serviceErrorCode(json);

  switch (raw) {
    case "invalid_url":
      return "invalid_youtube_url";
    case "captions_unavailable":
      return "transcripts_unavailable";
    case "video_unplayable":
      return "video_unplayable";
    case "track_not_found":
      return "track_not_found";
    case "youtube_blocked":
    case "upstream_error":
    case "request_too_large":
    case "server_misconfigured":
    case "unauthorized":
      return "youtube_fetch_failed";
    default:
      return "youtube_fetch_failed";
  }
}

function serviceErrorCode(json: unknown): string | null {
  const detail = isRecord(json) && isRecord(json.detail) ? json.detail : null;
  return (
    (detail && typeof detail.error === "string" ? detail.error : null) ||
    (isRecord(json) && typeof json.error === "string" ? json.error : null)
  );
}

function shouldRetryServiceResponse(status: number, serviceError: string | null): boolean {
  if (serviceError === "upstream_error") return true;
  if (!YOUTUBE_CAPTION_RETRY_STATUSES.has(status)) return false;
  return serviceError === null;
}

function retryDelayForAttempt(attempt: number): number | null {
  return YOUTUBE_CAPTION_RETRY_DELAYS_MS[attempt - 1] ?? null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeServiceResponse(text: string): string {
  const body = text.trim();
  const limit = 2000;
  if (body.length <= limit) return body;
  return `${body.slice(0, limit)} ... [truncated ${body.length - limit} chars]`;
}

function logYouTubeServiceErrorResponse(
  context: YouTubeCaptionServiceOptions,
  details: Record<string, unknown>
) {
  if (process.env.NODE_ENV === "production" && process.env.YOUTUBE_CAPTION_DEBUG !== "1") {
    return;
  }
  logYouTube(context, "service error response", details);
}

function normalizeTrack(value: unknown): YouTubeCaptionTrack | null {
  if (!isRecord(value)) return null;
  const track = value as ServiceTrack;
  const id = stringFromUnknown(track.id);
  const languageCode = stringFromUnknown(track.languageCode);
  if (!id || !languageCode) return null;

  return {
    id,
    languageCode,
    languageName: stringFromUnknown(track.languageName) || languageCode,
    isGenerated: track.isGenerated === true,
    isTranslatable: track.isTranslatable === true,
  };
}

function normalizeSnippet(value: unknown): YouTubeCaptionSnippet | null {
  if (!isRecord(value)) return null;
  const snippet = value as ServiceSnippet;
  const text = stringFromUnknown(snippet.text).replace(/\s+/g, " ").trim();
  const startMs = numberFromUnknown(snippet.startMs);
  const endMs = numberFromUnknown(snippet.endMs);
  if (!text || startMs === null || endMs === null) return null;
  return { text, startMs, endMs: Math.max(endMs, startMs + 1) };
}

function trackFromId(trackId: string, languageCode: string): YouTubeCaptionTrack {
  const [, kind] = trackId.split("|");
  return {
    id: trackId,
    languageCode,
    languageName: languageCode,
    isGenerated: kind === "asr",
    isTranslatable: false,
  };
}

function stringFromUnknown(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberFromUnknown(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function logYouTube(
  context: YouTubeCaptionServiceOptions,
  message: string,
  details?: Record<string, unknown>
) {
  console.warn(`[youtube-captions:${context.requestId}:${context.route}] ${message}`, details);
}
