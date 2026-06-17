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
  logYouTube(options, "service request started", { pathname });
  const response = await fetch(new URL(pathname, config.url), {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  logYouTube(options, "service response received", {
    pathname,
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    const code = mapServiceError(json);
    throw new YouTubeCaptionServiceError(code);
  }
  if (!isRecord(json)) throw new YouTubeCaptionServiceError("youtube_fetch_failed");
  return json as T;
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
  const detail = isRecord(json) && isRecord(json.detail) ? json.detail : null;
  const raw =
    (detail && typeof detail.error === "string" ? detail.error : null) ||
    (isRecord(json) && typeof json.error === "string" ? json.error : null);

  switch (raw) {
    case "invalid_url":
      return "invalid_youtube_url";
    case "captions_unavailable":
      return "transcripts_unavailable";
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
