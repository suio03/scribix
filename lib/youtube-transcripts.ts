import type { AaiSegment, AaiTranscript } from "@/lib/aai";

const WATCH_BASE = "https://www.youtube.com/watch";
const YOUTUBEI_BASE = "https://www.youtube.com/youtubei/v1/player";
const ANDROID_CLIENT_VERSION = "20.10.38";
const TRACK_CACHE_TTL_MS = 60_000;
const TRACK_CACHE_MAX_ENTRIES = 100;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

type PlayerResponse = {
  playabilityStatus?: {
    status?: string;
    reason?: string;
  };
  videoDetails?: {
    title?: string;
    lengthSeconds?: string;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: RawCaptionTrack[];
    };
  };
};

type RawCaptionTrack = {
  baseUrl?: string;
  name?: TextRuns;
  languageCode?: string;
  kind?: string;
  vssId?: string;
  isTranslatable?: boolean;
};

type TextRuns = {
  simpleText?: string;
  runs?: Array<{ text?: string }>;
};

export type YouTubeTranscriptTrack = {
  id: string;
  languageCode: string;
  languageName: string;
  isGenerated: boolean;
  isTranslatable: boolean;
};

type InternalTranscriptTrack = YouTubeTranscriptTrack & {
  baseUrl: string;
};

export type YouTubeTranscriptList = {
  videoId: string;
  title: string;
  durationSec: number | null;
  tracks: YouTubeTranscriptTrack[];
};

export type YouTubeTranscriptSnippet = {
  text: string;
  startMs: number;
  endMs: number;
};

type YouTubeTranscriptLogContext = {
  requestId: string;
  route: "list" | "import";
};

type CaptionCandidate = {
  label: string;
  url: URL;
};

type LoadTranscriptTracksResult = {
  videoId: string;
  title: string;
  durationSec: number | null;
  tracks: InternalTranscriptTrack[];
};

const trackCache = new Map<string, { expiresAt: number; value: LoadTranscriptTracksResult }>();

export class YouTubeTranscriptError extends Error {
  constructor(
    readonly code:
      | "invalid_youtube_url"
      | "youtube_fetch_failed"
      | "transcripts_unavailable"
      | "track_not_found"
      | "empty_transcript"
      | "youtube_duration_exceeds_tier",
    message = code
  ) {
    super(message);
    this.name = "YouTubeTranscriptError";
  }
}

export function extractYouTubeVideoId(input: string): string {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new YouTubeTranscriptError("invalid_youtube_url");
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id;
  }

  if (host.endsWith("youtube.com")) {
    const watchId = url.searchParams.get("v");
    if (watchId && /^[A-Za-z0-9_-]{11}$/.test(watchId)) return watchId;

    const parts = url.pathname.split("/").filter(Boolean);
    const keyed = ["embed", "shorts", "live"].includes(parts[0]) ? parts[1] : null;
    if (keyed && /^[A-Za-z0-9_-]{11}$/.test(keyed)) return keyed;
  }

  throw new YouTubeTranscriptError("invalid_youtube_url");
}

export async function listYouTubeTranscripts(
  input: string,
  logContext?: YouTubeTranscriptLogContext
): Promise<YouTubeTranscriptList> {
  const { videoId, title, durationSec, tracks } = await loadTranscriptTracks(input, logContext);
  return {
    videoId,
    title,
    durationSec,
    tracks: tracks.map(({ baseUrl: _baseUrl, ...track }) => track),
  };
}

export async function fetchYouTubeTranscript(
  input: string,
  trackId: string,
  logContext?: YouTubeTranscriptLogContext
): Promise<{
  videoId: string;
  title: string;
  durationSec: number;
  track: YouTubeTranscriptTrack;
  snippets: YouTubeTranscriptSnippet[];
}> {
  const { videoId, title, durationSec: metadataDurationSec, tracks } =
    await loadTranscriptTracks(input, logContext);
  const track = tracks.find((candidate) => candidate.id === trackId);
  if (!track) {
    logYouTube(logContext, "selected track was not found", {
      trackId,
      availableTrackIds: tracks.map((candidate) => candidate.id),
    });
    throw new YouTubeTranscriptError("track_not_found");
  }

  logYouTube(logContext, "selected track", {
    trackId,
    languageCode: track.languageCode,
    languageName: track.languageName,
    isGenerated: track.isGenerated,
    isTranslatable: track.isTranslatable,
  });

  const snippets = await fetchTrackSnippets(track.baseUrl, logContext);
  if (snippets.length === 0) {
    logYouTube(logContext, "caption track parsed empty", {
      trackId,
      videoId,
      languageCode: track.languageCode,
      isGenerated: track.isGenerated,
    });
    throw new YouTubeTranscriptError("empty_transcript");
  }

  const durationSec = Math.max(metadataDurationSec ?? 0, youtubeDurationSec(snippets));
  const { baseUrl: _baseUrl, ...publicTrack } = track;
  return { videoId, title, durationSec, track: publicTrack, snippets };
}

export function youtubeSnippetsToAaiTranscript({
  id,
  languageCode,
  snippets,
}: {
  id: string;
  languageCode: string;
  snippets: YouTubeTranscriptSnippet[];
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

export function youtubeDurationSec(snippets: YouTubeTranscriptSnippet[]): number {
  const endMs = snippets.reduce((max, snippet) => Math.max(max, snippet.endMs), 0);
  return Math.max(1, Math.ceil(endMs / 1000));
}

function readTrackCache(videoId: string): LoadTranscriptTracksResult | null {
  const cached = trackCache.get(videoId);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    trackCache.delete(videoId);
    return null;
  }
  return cached.value;
}

function writeTrackCache(videoId: string, value: LoadTranscriptTracksResult): void {
  const now = Date.now();
  if (trackCache.size >= TRACK_CACHE_MAX_ENTRIES) {
    for (const [key, cached] of trackCache) {
      if (cached.expiresAt <= now || trackCache.size >= TRACK_CACHE_MAX_ENTRIES) {
        trackCache.delete(key);
      }
      if (trackCache.size < TRACK_CACHE_MAX_ENTRIES) break;
    }
  }
  trackCache.set(videoId, { expiresAt: now + TRACK_CACHE_TTL_MS, value });
}

async function loadTranscriptTracks(
  input: string,
  logContext?: YouTubeTranscriptLogContext
): Promise<LoadTranscriptTracksResult> {
  const videoId = extractYouTubeVideoId(input);
  const cached = readTrackCache(videoId);
  if (cached) {
    logYouTube(logContext, "caption tracks loaded from cache", {
      videoId,
      trackCount: cached.tracks.length,
    });
    return cached;
  }

  const watchUrl = new URL(WATCH_BASE);
  watchUrl.searchParams.set("v", videoId);

  logYouTube(logContext, "loading watch page", { videoId });

  const watchHtml = await fetchWatchHtml(watchUrl, videoId, logContext);

  const pagePlayer = parseInitialPlayerResponse(watchHtml);
  const apiKey = extractInnertubeApiKey(watchHtml);
  logYouTube(logContext, "watch page parsed", {
    videoId,
    htmlBytes: watchHtml.length,
    hasPagePlayer: pagePlayer !== null,
    pageCaptionTracks:
      pagePlayer?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length ?? 0,
    hasInnertubeApiKey: apiKey !== null,
  });
  const innertubePlayer = apiKey
    ? await fetchPlayerResponse(videoId, apiKey, logContext)
    : null;
  const player = hasCaptionTracks(innertubePlayer) ? innertubePlayer : pagePlayer;

  const rawTracks =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  logYouTube(logContext, "caption tracks loaded", {
    videoId,
    rawTrackCount: rawTracks.length,
    source: hasCaptionTracks(innertubePlayer) ? "youtubei" : "watch-page",
  });
  if (rawTracks.length === 0) {
    throw new YouTubeTranscriptError("transcripts_unavailable");
  }

  const title = player?.videoDetails?.title?.trim() || `YouTube ${videoId}`;
  const durationSec = secondsFromUnknown(player?.videoDetails?.lengthSeconds);
  const tracks = rawTracks
    .map((track, index): InternalTranscriptTrack | null => {
      if (!track.baseUrl || !track.languageCode) return null;
      const isGenerated = track.kind === "asr";
      const languageName = textRunsToString(track.name) || track.languageCode;
      return {
        id: [
          track.vssId ?? track.languageCode,
          isGenerated ? "asr" : "manual",
          String(index),
        ].join("|"),
        languageCode: track.languageCode,
        languageName,
        isGenerated,
        isTranslatable: track.isTranslatable === true,
        baseUrl: normalizeTranscriptUrl(track.baseUrl),
      };
    })
    .filter((track): track is InternalTranscriptTrack => track !== null);

  if (tracks.length === 0) throw new YouTubeTranscriptError("transcripts_unavailable");
  logYouTube(logContext, "caption tracks normalized", {
    videoId,
    title,
    tracks: tracks.map((track) => ({
      id: track.id,
      languageCode: track.languageCode,
      languageName: track.languageName,
      isGenerated: track.isGenerated,
      isTranslatable: track.isTranslatable,
      captionUrl: summarizeCaptionUrl(track.baseUrl),
    })),
  });
  const result = { videoId, title, durationSec, tracks };
  writeTrackCache(videoId, result);
  return result;
}

async function fetchPlayerResponse(
  videoId: string,
  apiKey: string,
  logContext?: YouTubeTranscriptLogContext
): Promise<PlayerResponse | null> {
  const res = await fetch(`${YOUTUBEI_BASE}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json",
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: ANDROID_CLIENT_VERSION,
        },
      },
      videoId,
    }),
  });
  logYouTube(logContext, "youtubei player response", {
    videoId,
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get("content-type"),
  });
  if (!res.ok) throw new YouTubeTranscriptError("youtube_fetch_failed");
  const player = (await res.json()) as PlayerResponse;
  logYouTube(logContext, "youtubei player parsed", {
    videoId,
    playabilityStatus: player.playabilityStatus?.status,
    playabilityReason: player.playabilityStatus?.reason,
    captionTrackCount:
      player.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length ?? 0,
  });
  return player;
}

async function fetchWatchHtml(
  watchUrl: URL,
  videoId: string,
  logContext?: YouTubeTranscriptLogContext
): Promise<string> {
  const first = await fetchWatchHtmlOnce(watchUrl, videoId, logContext);
  if (!first.html.includes('action="https://consent.youtube.com/s"')) {
    return first.html;
  }

  const consentToken = first.html.match(/name="v" value="(.*?)"/)?.[1];
  logYouTube(logContext, "watch page requested consent", {
    videoId,
    hasConsentToken: consentToken !== undefined,
  });
  if (!consentToken) return first.html;

  return (
    await fetchWatchHtmlOnce(watchUrl, videoId, logContext, {
      cookie: `CONSENT=YES+${consentToken}`,
    })
  ).html;
}

async function fetchWatchHtmlOnce(
  watchUrl: URL,
  videoId: string,
  logContext?: YouTubeTranscriptLogContext,
  extraHeaders?: Record<string, string>
): Promise<{ html: string }> {
  const watchRes = await fetch(watchUrl, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT,
      ...extraHeaders,
    },
  });
  logYouTube(logContext, "watch page response", {
    videoId,
    status: watchRes.status,
    ok: watchRes.ok,
    contentType: watchRes.headers.get("content-type"),
    usedConsentCookie: extraHeaders?.cookie !== undefined,
  });
  if (!watchRes.ok) throw new YouTubeTranscriptError("youtube_fetch_failed");
  return { html: decodeEntities(await watchRes.text()) };
}

function hasCaptionTracks(player: PlayerResponse | null): player is PlayerResponse {
  return Boolean(
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length
  );
}

function parseInitialPlayerResponse(html: string): PlayerResponse | null {
  const markers = ["var ytInitialPlayerResponse =", "ytInitialPlayerResponse ="];
  for (const marker of markers) {
    const json = parseJsonAfterMarker(html, marker);
    if (json) return json as PlayerResponse;
  }
  return null;
}

function parseJsonAfterMarker(html: string, marker: string): unknown | null {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return null;

  const start = html.indexOf("{", markerIndex + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractInnertubeApiKey(html: string): string | null {
  const match =
    html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/) ??
    html.match(/"innertubeApiKey"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

async function fetchTrackSnippets(
  baseUrl: string,
  logContext?: YouTubeTranscriptLogContext
): Promise<YouTubeTranscriptSnippet[]> {
  const candidates: CaptionCandidate[] = [
    { label: "normalized", url: captionBaseUrl(baseUrl) },
    { label: "srv3", url: captionUrl(baseUrl, "srv3") },
    { label: "json3", url: captionUrl(baseUrl, "json3") },
    { label: "ttml", url: captionUrl(baseUrl, "ttml") },
  ];

  for (const candidate of candidates) {
    const snippets = await fetchSnippetsFromUrl(candidate, logContext);
    if (snippets.length > 0) return snippets;
  }

  return [];
}

function captionUrl(baseUrl: string, fmt: string): URL {
  const url = captionBaseUrl(baseUrl);
  url.searchParams.set("fmt", fmt);
  return url;
}

function normalizeTranscriptUrl(baseUrl: string): string {
  const url = captionBaseUrl(baseUrl);
  if (url.searchParams.get("fmt") === "srv3") {
    url.searchParams.delete("fmt");
  }
  return url.toString();
}

function captionBaseUrl(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new YouTubeTranscriptError("youtube_fetch_failed");
  }
  assertAllowedCaptionUrl(url);
  return url;
}

function assertAllowedCaptionUrl(url: URL): void {
  const host = url.hostname.toLowerCase();
  if (host === "youtube.com" || host.endsWith(".youtube.com")) return;
  throw new YouTubeTranscriptError("youtube_fetch_failed");
}

async function fetchSnippetsFromUrl(
  candidate: CaptionCandidate,
  logContext?: YouTubeTranscriptLogContext
): Promise<YouTubeTranscriptSnippet[]> {
  const { label, url } = candidate;
  const res = await fetch(url, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": USER_AGENT,
    },
  });
  logYouTube(logContext, "caption response", {
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get("content-type"),
    candidate: label,
    captionUrl: summarizeCaptionUrl(url),
  });
  if (!res.ok) throw new YouTubeTranscriptError("youtube_fetch_failed");

  const raw = await res.text();
  logYouTube(logContext, "caption body received", {
    bytes: raw.length,
    preview: raw.slice(0, 240),
    candidate: label,
    captionUrl: summarizeCaptionUrl(url),
  });
  try {
    const snippets = snippetsFromJson3(JSON.parse(raw));
    logYouTube(logContext, "json3 parse result", {
      snippetCount: snippets.length,
      candidate: label,
      captionUrl: summarizeCaptionUrl(url),
    });
    if (snippets.length > 0) return snippets;
  } catch (error) {
    logYouTube(logContext, "json3 parse failed, trying xml", {
      error: error instanceof Error ? error.message : String(error),
      candidate: label,
      captionUrl: summarizeCaptionUrl(url),
    });
  }
  const snippets = snippetsFromXml(raw);
  logYouTube(logContext, "xml parse result", {
    snippetCount: snippets.length,
    candidate: label,
    captionUrl: summarizeCaptionUrl(url),
  });
  return snippets;
}

function snippetsFromJson3(json: unknown): YouTubeTranscriptSnippet[] {
  const events = isRecord(json) && Array.isArray(json.events) ? json.events : [];
  const snippets: YouTubeTranscriptSnippet[] = [];

  for (const event of events) {
    if (!isRecord(event)) continue;
    const startMs = numberFromUnknown(event.tStartMs);
    if (startMs === null || !Array.isArray(event.segs)) continue;
    const text = event.segs
      .map((seg) => (isRecord(seg) && typeof seg.utf8 === "string" ? seg.utf8 : ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    const durationMs = numberFromUnknown(event.dDurationMs) ?? 0;
    snippets.push({
      text,
      startMs,
      endMs: startMs + Math.max(durationMs, 1),
    });
  }

  return fillMissingEnds(snippets);
}

function snippetsFromXml(xml: string): YouTubeTranscriptSnippet[] {
  const snippets: YouTubeTranscriptSnippet[] = [];
  const textRe = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;

  while ((match = textRe.exec(xml))) {
    const attrs = match[1];
    const start = Number(attrs.match(/\bstart="([^"]+)"/)?.[1]);
    const duration = Number(attrs.match(/\bdur="([^"]+)"/)?.[1] ?? "0");
    const text = decodeEntities(match[2])
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!Number.isFinite(start) || !text) continue;
    const startMs = Math.round(start * 1000);
    snippets.push({
      text,
      startMs,
      endMs: startMs + Math.max(1, Math.round(duration * 1000)),
    });
  }

  if (snippets.length > 0) return fillMissingEnds(snippets);
  return fillMissingEnds(snippetsFromParagraphXml(xml));
}

function snippetsFromParagraphXml(xml: string): YouTubeTranscriptSnippet[] {
  const snippets: YouTubeTranscriptSnippet[] = [];
  const paragraphRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;

  while ((match = paragraphRe.exec(xml))) {
    const attrs = match[1];
    const startMs = parseXmlTimeMs(
      attrs.match(/\bt="([^"]+)"/)?.[1] ??
        attrs.match(/\bbegin="([^"]+)"/)?.[1]
    );
    const durationMs = parseXmlTimeMs(
      attrs.match(/\bd="([^"]+)"/)?.[1] ??
        attrs.match(/\bdur="([^"]+)"/)?.[1]
    );
    const text = decodeEntities(match[2])
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (startMs === null || !text) continue;
    snippets.push({
      text,
      startMs,
      endMs: startMs + Math.max(1, durationMs ?? 0),
    });
  }

  return snippets;
}

function parseXmlTimeMs(value: string | undefined): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const clock = value.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
  if (clock) {
    const h = Number(clock[1] ?? 0);
    const m = Number(clock[2]);
    const s = Number(clock[3]);
    return Math.round((h * 3600 + m * 60 + s) * 1000);
  }
  const seconds = Number(value.replace(/s$/, ""));
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
}

function fillMissingEnds(snippets: YouTubeTranscriptSnippet[]): YouTubeTranscriptSnippet[] {
  return snippets.map((snippet, index) => {
    if (snippet.endMs > snippet.startMs + 1) return snippet;
    const next = snippets[index + 1];
    return {
      ...snippet,
      endMs: next ? Math.max(next.startMs, snippet.startMs + 1) : snippet.startMs + 3000,
    };
  });
}

function textRunsToString(value: TextRuns | undefined): string {
  if (!value) return "";
  if (typeof value.simpleText === "string") return value.simpleText.trim();
  return value.runs?.map((run) => run.text ?? "").join("").trim() ?? "";
}

function numberFromUnknown(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function secondsFromUnknown(value: unknown): number | null {
  const number = numberFromUnknown(value);
  return number === null ? null : Math.max(1, Math.ceil(number));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );
}

function logYouTube(
  context: YouTubeTranscriptLogContext | undefined,
  message: string,
  details?: Record<string, unknown>
) {
  if (!context) return;
  console.warn(`[youtube-transcripts:${context.requestId}:${context.route}] ${message}`, details);
}

function summarizeCaptionUrl(input: string | URL): Record<string, unknown> {
  const url = typeof input === "string" ? new URL(input) : input;
  return {
    host: url.hostname,
    path: url.pathname,
    fmt: url.searchParams.get("fmt"),
    lang: url.searchParams.get("lang"),
    tlang: url.searchParams.get("tlang"),
    name: url.searchParams.get("name"),
    kind: url.searchParams.get("kind"),
    paramKeys: Array.from(url.searchParams.keys()).sort(),
  };
}
