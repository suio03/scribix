"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { CheckCircle2, Link2, Loader2, PlaySquare } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  youtubeImportsFor,
  youtubeMaxVideoSecFor,
  type BillingCycle,
  type Tier,
} from "@/lib/plans";
import { trackEvent } from "@/lib/analytics";
import { markSignInPending } from "./Track";

type YouTubeTrack = {
  id: string;
  languageCode: string;
  languageName: string;
  isGenerated: boolean;
  isTranslatable: boolean;
};

type InspectResult = {
  videoId: string;
  title: string;
  durationSec: number | null;
  tracks: YouTubeTrack[];
};

type Phase = "idle" | "inspecting" | "ready" | "importing" | "error";
const YOUTUBE_OAUTH_CONTEXT_KEY = "scribix:youtube_oauth_context";

export function YouTubeImporter({
  signedIn,
  postSignInPath,
  tier = "free",
  billingCycle = null,
  variant = "card",
}: {
  signedIn: boolean;
  postSignInPath: string;
  tier?: Tier;
  billingCycle?: BillingCycle | null;
  variant?: "card" | "flat";
}) {
  const t = useTranslations("Dashboard.youtube");
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<InspectResult | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const restoredRef = useRef(false);

  const selectedTrack = useMemo(
    () => result?.tracks.find((track) => track.id === selectedTrackId) ?? null,
    [result, selectedTrackId]
  );
  const busy = phase === "inspecting" || phase === "importing";

  useEffect(() => {
    if (!signedIn || restoredRef.current) return;
    restoredRef.current = true;
    const restoredUrl = takeYouTubeOAuthUrl(postSignInPath);
    if (!restoredUrl) return;
    setUrl(restoredUrl);
    void inspect(restoredUrl);
  }, [signedIn, postSignInPath]);

  async function inspect(urlOverride?: string) {
    if (busy) return;
    const requestedUrl = (urlOverride ?? url).trim();
    if (!signedIn) {
      saveYouTubeOAuthUrl(requestedUrl, postSignInPath);
      markSignInPending();
      await signIn("google", { redirectTo: postSignInPath });
      return;
    }

    setPhase("inspecting");
    setError(null);
    setResult(null);
    trackEvent("youtube_inspect_attempt", { step: "inspect" });

    try {
      const response = await fetch("/api/transcripts/youtube", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: requestedUrl }),
      });
      const json = (await response.json()) as InspectResult | YouTubeErrorPayload;
      if (!response.ok) {
        throw youTubeImportError(json as YouTubeErrorPayload, "youtube_fetch_failed");
      }

      const inspectResult = json as InspectResult;
      if (inspectResult.tracks.length === 0) throw new Error("transcripts_unavailable");
      setResult(inspectResult);
      setSelectedTrackId(preferredTrackId(inspectResult.tracks));
      setPhase("ready");
    } catch (caught) {
      trackEvent("youtube_inspect_fail", youtubeInspectFailureProps(caught));
      setError(errorMessage(caught, t));
      setPhase("error");
    }
  }

  async function importTranscript() {
    if (busy || !result || !selectedTrack) return;
    setPhase("importing");
    setError(null);
    trackEvent("youtube_import_attempt", { step: "import" });

    try {
      const response = await fetch("/api/transcripts/youtube/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, trackId: selectedTrack.id }),
      });
      const json = (await response.json()) as YouTubeImportResponse | YouTubeErrorPayload;
      if (!response.ok) {
        throw youTubeImportError(json as YouTubeErrorPayload, "youtube_fetch_failed");
      }
      const imported = json as YouTubeImportResponse;
      if (!imported.transcriptId) {
        throw new Error("youtube_fetch_failed");
      }
      router.push(`/dashboard/transcripts/${imported.transcriptId}`);
    } catch (caught) {
      trackEvent("youtube_import_fail", youtubeImportFailureProps(caught));
      setError(errorMessage(caught, t));
      setPhase("error");
    }
  }

  const framed = variant === "card";

  return (
    <div className={framed ? "rounded-2xl border border-line bg-card p-6 sm:p-8" : "rise-in"}>
      <div className="flex items-start gap-3">
        <span className="inline-grid size-11 shrink-0 place-items-center rounded-xl bg-[#ff0000]/10 text-[#cc0000]">
          <PlaySquare size={22} strokeWidth={1.7} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-tight text-ink">{t("title")}</h2>
          <p className="mt-1 text-sm leading-6 text-ink/65">{t("description")}</p>
          <p className="mt-1 text-[12px] leading-5 text-ink/50">
            {youtubeLimitCopy(t, tier, billingCycle)}
          </p>
        </div>
      </div>

      <form
        className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void inspect();
        }}
      >
        <label className="relative min-w-0">
          <span className="sr-only">{t("urlLabel")}</span>
          <Link2
            size={16}
            strokeWidth={1.8}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/45"
          />
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={t("placeholder")}
            className="w-full rounded-xl border border-line bg-paper py-3 pl-11 pr-4 text-[14px] text-ink outline-none transition placeholder:text-ink/35 focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
          />
        </label>
        <button
          type="submit"
          disabled={busy || url.trim().length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-[14px] font-medium text-paper transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-55"
        >
          {phase === "inspecting" ? <Loader2 size={16} className="animate-spin" /> : null}
          {phase === "inspecting" ? t("checking") : t("check")}
        </button>
      </form>

      {result ? (
        <div className="mt-5 rounded-xl border border-line bg-paper/80 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-sage" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-ink">{result.title}</p>
              <p className="mt-0.5 text-[12px] text-ink/55">
                {t("tracksFound", { count: result.tracks.length })}
              </p>
            </div>
          </div>

          {result.tracks.length > 1 ? (
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink/65">
                {t("languageLabel")}
              </span>
              <select
                value={selectedTrackId}
                onChange={(event) => setSelectedTrackId(event.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
              >
                {result.tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {trackLabel(track, t)}
                  </option>
                ))}
              </select>
            </label>
          ) : selectedTrack ? (
            <p className="mt-4 rounded-lg bg-ink/[0.03] px-3 py-2 text-[13px] text-ink/70">
              {trackLabel(selectedTrack, t)}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void importTranscript()}
            disabled={!selectedTrack || phase === "importing"}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-[14px] font-medium text-paper transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
          >
            {phase === "importing" ? <Loader2 size={16} className="animate-spin" /> : null}
            {phase === "importing" ? t("importing") : t("import")}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function saveYouTubeOAuthUrl(url: string, postSignInPath: string): void {
  if (!url) return;
  try {
    sessionStorage.setItem(YOUTUBE_OAUTH_CONTEXT_KEY, JSON.stringify({
      url,
      postSignInPath,
      savedAt: Date.now(),
    }));
  } catch {}
}

function takeYouTubeOAuthUrl(postSignInPath: string): string | null {
  try {
    const raw = sessionStorage.getItem(YOUTUBE_OAUTH_CONTEXT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(YOUTUBE_OAUTH_CONTEXT_KEY);
    const value = JSON.parse(raw) as {
      url?: unknown;
      postSignInPath?: unknown;
      savedAt?: unknown;
    };
    if (
      typeof value.url !== "string" ||
      typeof value.postSignInPath !== "string" ||
      value.postSignInPath !== postSignInPath ||
      typeof value.savedAt !== "number" ||
      Date.now() - value.savedAt > 30 * 60 * 1000
    ) {
      return null;
    }
    return value.url;
  } catch {
    return null;
  }
}

function preferredTrackId(tracks: YouTubeTrack[]): string {
  const languages =
    typeof navigator === "undefined" ? [] : [...navigator.languages, navigator.language];
  const normalized = languages.map(normalizeLanguage).filter(Boolean);

  for (const language of normalized) {
    const exact = tracks.find((track) => normalizeLanguage(track.languageCode) === language);
    if (exact) return exact.id;
  }

  for (const language of normalized) {
    const base = language.split("-")[0];
    const match = tracks.find((track) => normalizeLanguage(track.languageCode).split("-")[0] === base);
    if (match) return match.id;
  }

  return (
    tracks.find((track) => normalizeLanguage(track.languageCode).startsWith("en")) ??
    tracks.find((track) => !track.isGenerated) ??
    tracks[0]
  ).id;
}

function normalizeLanguage(value: string): string {
  return value.trim().toLowerCase().replace("_", "-");
}

function trackLabel(
  track: YouTubeTrack,
  t: ReturnType<typeof useTranslations<"Dashboard.youtube">>
): string {
  const source = track.isGenerated ? t("autoGenerated") : t("manual");
  return `${track.languageName} (${track.languageCode}) - ${source}`;
}

function errorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations<"Dashboard.youtube">>
): string {
  const code = error instanceof Error ? error.message : String(error);
  if (error instanceof YouTubeImportError) {
    if (error.code === "youtube_duration_exceeds_tier") {
      return t("errorDurationExceeded", {
        maxHours: formatHours(error.maxSec ?? 0),
      });
    }
    if (error.code === "youtube_quota_exceeded") {
      return t("errorQuotaExceeded");
    }
    if (error.code === "youtube_inspect_rate_limited") {
      return t("errorInspectRateLimited");
    }
  }
  switch (code) {
    case "invalid_youtube_url":
    case "missing_url":
      return t("errorInvalidUrl");
    case "transcripts_unavailable":
      return t("errorUnavailable");
    case "video_unplayable":
      return t("errorVideoUnplayable");
    case "track_not_found":
      return t("errorTrackMissing");
    case "empty_transcript":
      return t("errorEmpty");
    case "youtube_quota_exceeded":
      return t("errorQuotaExceeded");
    case "youtube_inspect_rate_limited":
      return t("errorInspectRateLimited");
    case "youtube_duration_exceeds_tier":
      return t("errorDurationExceeded", { maxHours: formatHours(0) });
    default:
      return t("errorGeneric");
  }
}

type YouTubeErrorPayload = {
  error?: string;
  cap?: number;
  remaining?: number;
  maxSec?: number;
  durationSec?: number;
  retryAfterSec?: number;
};

type YouTubeImportResponse = {
  transcriptId?: string;
  error?: string;
};

type YouTubeFailureService = "scribix_app" | "youtube_caption_service";
type YouTubeFailureType = "technical" | "product_limit" | "quota" | "auth" | "user_input";
type YouTubeFailureMeta = {
  service: YouTubeFailureService;
  errorType: YouTubeFailureType;
};

const YOUTUBE_FAILURE_META: Record<string, YouTubeFailureMeta> = {
  invalid_youtube_url: { service: "scribix_app", errorType: "user_input" },
  missing_url: { service: "scribix_app", errorType: "user_input" },
  missing_track: { service: "scribix_app", errorType: "user_input" },
  invalid_json: { service: "scribix_app", errorType: "user_input" },
  unauthorized: { service: "scribix_app", errorType: "auth" },
  user_not_found: { service: "scribix_app", errorType: "auth" },
  youtube_quota_exceeded: { service: "scribix_app", errorType: "quota" },
  youtube_inspect_rate_limited: { service: "scribix_app", errorType: "quota" },
  youtube_duration_exceeds_tier: { service: "scribix_app", errorType: "quota" },
  missing_youtube_service_config: { service: "scribix_app", errorType: "technical" },
  transcripts_unavailable: { service: "youtube_caption_service", errorType: "product_limit" },
  video_unplayable: { service: "youtube_caption_service", errorType: "product_limit" },
  track_not_found: { service: "youtube_caption_service", errorType: "product_limit" },
  empty_transcript: { service: "youtube_caption_service", errorType: "product_limit" },
  youtube_fetch_failed: { service: "youtube_caption_service", errorType: "technical" },
  network_error: { service: "youtube_caption_service", errorType: "technical" },
  unknown: { service: "youtube_caption_service", errorType: "technical" },
};

class YouTubeImportError extends Error {
  constructor(
    readonly code: string,
    readonly maxSec?: number
  ) {
    super(code);
    this.name = "YouTubeImportError";
  }
}

function youTubeImportError(payload: YouTubeErrorPayload, fallback: string): YouTubeImportError {
  return new YouTubeImportError(payload.error ?? fallback, payload.maxSec);
}

function youtubeInspectFailureProps(error: unknown) {
  return {
    ...youtubeFailureProps(error),
    step: "inspect" as const,
  };
}

function youtubeImportFailureProps(error: unknown) {
  return {
    ...youtubeFailureProps(error),
    step: "import" as const,
  };
}

function youtubeFailureProps(error: unknown) {
  const normalized = normalizedYouTubeFailureCode(error);
  const meta = YOUTUBE_FAILURE_META[normalized] ?? YOUTUBE_FAILURE_META.unknown;
  return {
    service: meta.service,
    error_type: meta.errorType,
    error_code: normalized,
  };
}

function normalizedYouTubeFailureCode(error: unknown): string {
  if (error instanceof YouTubeImportError) {
    return YOUTUBE_FAILURE_META[error.code] ? error.code : "unknown";
  }
  if (error instanceof Error) {
    return "network_error";
  }
  return "unknown";
}

function youtubeLimitCopy(
  t: ReturnType<typeof useTranslations<"Dashboard.youtube">>,
  tier: Tier,
  billingCycle: BillingCycle | null
): string {
  const imports = youtubeImportsFor(tier, billingCycle);
  const maxHours = formatHours(youtubeMaxVideoSecFor(tier));
  if (tier === "free") {
    return t("limitsFree", { imports, maxHours });
  }
  const period = billingCycle === "yearly" ? t("periodYear") : t("periodMonth");
  return t("limitsPaid", { imports, maxHours, period });
}

function formatHours(seconds: number): string {
  const hours = Math.max(1, Math.round(seconds / 3600));
  return String(hours);
}
