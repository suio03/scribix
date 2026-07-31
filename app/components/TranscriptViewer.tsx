"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Languages, MessageCircle, Pause, Play, Sparkles, Users, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AaiSegment } from "@/lib/aai";
import { compactCJKSpaces } from "@/lib/transcript-format";
import { UpgradePlanModal, type UpgradeReason } from "./UpgradePlanModal";
import { TranscriptChatPanel } from "./TranscriptChatPanel";
import { displaySpeakerName, speakerToneFor, type SpeakerNames } from "./speakerDisplay";
import type { PartialTranscriptInfo } from "@/lib/partial-transcript";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
const TRANSLATION_LANGUAGES = ["en", "zh", "es", "fr", "de", "ja", "ko", "pt", "it", "nl"] as const;
let youtubeIframeApiPromise: Promise<YouTubeApi> | null = null;

type ContentTab = "transcript" | "subtitles" | "translation";
type AiTab = "chat" | "summary";
type TranslationLang = (typeof TRANSLATION_LANGUAGES)[number];
type TranslationState = "idle" | "loading" | "processing" | "ready" | "error";
type SummaryState = "idle" | "loading" | "processing" | "ready" | "error";

type TranslationPayload = {
  lang: string;
  text: string;
  utterances: AaiSegment[];
};

type SummaryPayload = {
  summary: string;
};

type ErrorPayload = {
  error?: string;
  requestId?: string;
};

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
};

type YouTubeApi = {
  Player: new (
    element: HTMLIFrameElement,
    options?: {
      events?: {
        onReady?: () => void;
      };
    }
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type Props = {
  id: string;
  audioUrl: string | null;
  mediaMime: string | null;
  utterances: AaiSegment[];
  paragraphs: AaiSegment[];
  sentences: AaiSegment[];
  fallbackText: string;
  sourceLanguage: string | null;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  speakerNames: SpeakerNames;
  speakers: string[];
  isPaid: boolean;
  isPro: boolean;
  checkoutSuccessPath: string;
  onOpenExport: () => void;
  onOpenSpeakerEditor: (speaker?: string) => void;
  partialTranscript: PartialTranscriptInfo | null;
};

export function TranscriptViewer({
  id,
  audioUrl,
  mediaMime,
  utterances,
  paragraphs,
  sentences,
  fallbackText,
  sourceLanguage,
  youtubeVideoId,
  speakerNames,
  speakers,
  isPaid,
  isPro,
  checkoutSuccessPath,
  onOpenExport,
  onOpenSpeakerEditor,
  partialTranscript,
}: Props) {
  const t = useTranslations("Dashboard.viewer");
  const exportT = useTranslations("Dashboard.exportPanel");
  const audioRef = useRef<HTMLMediaElement | null>(null);
  const youtubeFrameRef = useRef<HTMLIFrameElement | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const summaryPollTimerRef = useRef<number | null>(null);
  const requestRef = useRef(0);
  const summaryRequestRef = useRef(0);
  const [contentTab, setContentTab] = useState<ContentTab>("transcript");
  const [aiTab, setAiTab] = useState<AiTab>("chat");
  const [currentMs, setCurrentMs] = useState(0);
  const [translationLang, setTranslationLang] = useState<TranslationLang>(() =>
    firstTargetLanguage(sourceLanguage)
  );
  const [translationState, setTranslationState] = useState<TranslationState>("idle");
  const [translation, setTranslation] = useState<TranslationPayload | null>(null);
  const [summaryState, setSummaryState] = useState<SummaryState>("idle");
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<UpgradeReason | null>(null);
  const translationEnabled = !youtubeVideoId;

  const seekTo = (ms: number) => {
    const a = audioRef.current;
    if (a) {
      a.currentTime = ms / 1000;
      a.play().catch(() => {});
      setCurrentMs(ms);
      return;
    }
    const frame = youtubeFrameRef.current;
    if (!frame?.contentWindow) return;
    const seconds = Math.max(0, ms / 1000);
    frame.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
      "https://www.youtube.com"
    );
    frame.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      "https://www.youtube.com"
    );
    setCurrentMs(ms);
  };

  const transcriptSegments = useMemo(() => {
    const baseSegments = utterances.length > 0 ? utterances : paragraphs;
    return youtubeVideoId ? groupYouTubeTranscriptSegments(baseSegments) : baseSegments;
  }, [paragraphs, utterances, youtubeVideoId]);
  const sourceTranslationLang = normalizeSourceTranslationLang(sourceLanguage);
  const availableTranslationLanguages = useMemo(
    () => TRANSLATION_LANGUAGES.filter((language) => language !== sourceTranslationLang),
    [sourceTranslationLang]
  );
  const translationSegments = translation?.utterances ?? [];
  const segments = contentTab === "transcript" ? transcriptSegments : sentences;
  const hasSegments = segments.length > 0;
  const speakerLabel = (speaker: string) =>
    displaySpeakerName(speaker, speakerNames, (id) => t("speakerLabel", { speaker: id }));

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      if (summaryPollTimerRef.current) window.clearTimeout(summaryPollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (availableTranslationLanguages.some((language) => language === translationLang)) return;
    setTranslationLang(availableTranslationLanguages[0] ?? "en");
    setTranslation(null);
    setTranslationState("idle");
  }, [availableTranslationLanguages, translationLang]);

  useEffect(() => {
    if (translationEnabled || contentTab !== "translation") return;
    setContentTab("transcript");
    setTranslation(null);
    setTranslationState("idle");
  }, [contentTab, translationEnabled]);

  useEffect(() => {
    if (!translationEnabled || contentTab !== "translation" || !isPaid) return;
    void loadTranslation("GET");
  }, [contentTab, isPaid, translationEnabled, translationLang]);

  useEffect(() => {
    if (aiTab !== "summary" || !isPaid) return;
    void loadSummary("GET");
  }, [aiTab, isPaid]);

  async function loadTranslation(method: "GET" | "POST") {
    if (!isPaid) {
      setUpgradeModal("translation");
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    setTranslationState((state) => (method === "GET" && translation ? state : "loading"));

    try {
      const response = await fetch(`/api/transcripts/${id}/translations/${translationLang}`, {
        method,
      });
      if (requestRef.current !== requestId) return;

      if (response.status === 202) {
        setTranslationState("processing");
        pollTimerRef.current = window.setTimeout(() => {
          void loadTranslation("GET");
        }, 2000);
        return;
      }
      if (response.status === 402) {
        setUpgradeModal("translation");
        setTranslationState("idle");
        return;
      }
      if (response.status === 404 && method === "GET") {
        setTranslation(null);
        setTranslationState("idle");
        return;
      }
      if (!response.ok) throw new Error(`translation_${response.status}`);

      const json = (await response.json()) as TranslationPayload;
      setTranslation(json);
      setTranslationState("ready");
    } catch {
      if (requestRef.current === requestId) setTranslationState("error");
    }
  }

  async function loadSummary(method: "GET" | "POST") {
    if (!isPaid) {
      setUpgradeModal("summary");
      return;
    }

    const requestId = summaryRequestRef.current + 1;
    summaryRequestRef.current = requestId;
    if (summaryPollTimerRef.current) window.clearTimeout(summaryPollTimerRef.current);
    setSummaryState((state) => (method === "GET" && summary ? state : "loading"));
    setSummaryError(null);

    try {
      const response = await fetch(`/api/transcripts/${id}/summary`, { method });
      if (summaryRequestRef.current !== requestId) return;

      if (response.status === 202) {
        setSummaryState("processing");
        summaryPollTimerRef.current = window.setTimeout(() => {
          void loadSummary("GET");
        }, 2000);
        return;
      }
      if (response.status === 402) {
        setUpgradeModal("summary");
        setSummaryState("idle");
        return;
      }
      if (response.status === 404 && method === "GET") {
        setSummary(null);
        setSummaryState("idle");
        return;
      }
      if (!response.ok) {
        const payload = await readErrorPayload(response);
        throw new Error(payload?.requestId ? `Reference: ${payload.requestId}` : "");
      }

      const json = (await response.json()) as SummaryPayload;
      setSummary(json);
      setSummaryState("ready");
    } catch (error) {
      if (summaryRequestRef.current === requestId) {
        setSummaryError(error instanceof Error ? error.message : null);
        setSummaryState("error");
      }
    }
  }

  return (
    <>
      <div className="transcript-viewer overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_24px_70px_-48px_rgba(14,13,11,0.32)] lg:grid lg:h-[calc(100dvh-14.5rem)] lg:min-h-[640px] lg:grid-cols-2 lg:divide-x lg:divide-line">
        <section className="flex min-h-0 flex-col bg-paper">
          <div className="shrink-0 space-y-4 border-b border-line p-4 sm:p-5">
            {partialTranscript ? (
              <div className="rounded-xl border border-accent/25 bg-accent-soft/50 px-4 py-3 text-[13px] font-medium text-accent">
                {partialTranscript.sourceMinutes === null
                  ? t("partialUnknownLabel", {
                      processedMin: partialTranscript.processedMinutes,
                    })
                  : t("partialLabel", {
                      processedMin: partialTranscript.processedMinutes,
                      sourceMin: partialTranscript.sourceMinutes,
                    })}
              </div>
            ) : null}
            {audioUrl ? (
              <AudioPlayer
                ref={audioRef}
                url={audioUrl}
                isVideo={mediaMime?.startsWith("video/") === true}
                onTimeUpdate={setCurrentMs}
              />
            ) : null}

            {youtubeVideoId ? (
              <YouTubeEmbed
                ref={youtubeFrameRef}
                videoId={youtubeVideoId}
                onTimeUpdate={setCurrentMs}
              />
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="transcript-tabs flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl bg-ink/5 p-1">
                <TabButton
                  active={contentTab === "transcript"}
                  onClick={() => setContentTab("transcript")}
                >
                  {t("tabTranscript")}
                </TabButton>
                <TabButton
                  active={contentTab === "subtitles"}
                  onClick={() => setContentTab("subtitles")}
                >
                  {t("tabSubtitles")}
                </TabButton>
                {translationEnabled ? (
                  <TabButton
                    active={contentTab === "translation"}
                    onClick={() => {
                      if (!isPaid) {
                        setUpgradeModal("translation");
                        return;
                      }
                      setContentTab("translation");
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {safeT(t, "tabTranslation", "Translation")}
                      {!isPaid ? (
                        <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                          {safeT(t, "proBadge", "Pro")}
                        </span>
                      ) : null}
                    </span>
                  </TabButton>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-1.5">
                {speakers.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => onOpenSpeakerEditor()}
                    title={t("editSpeakersTitle")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-ink/60 transition hover:bg-ink/5 hover:text-ink"
                  >
                    <Users size={14} />
                    <span className="hidden 2xl:inline">
                      {t("speakersCount", { count: speakers.length })}
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onOpenExport}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-card px-3 text-[12px] font-semibold text-ink/75 transition hover:border-accent/35 hover:bg-accent-soft/45 hover:text-ink"
                >
                  <Download size={14} />
                  {exportT("tabExport")}
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-[70dvh] min-h-[420px] overflow-y-auto overscroll-contain p-4 sm:p-5 lg:min-h-0 lg:max-h-none lg:flex-1">
            {translationEnabled && contentTab === "translation" ? (
              <TranslationPanel
                lang={translationLang}
                languages={availableTranslationLanguages}
                state={translationState}
                text={translation?.text ?? ""}
                segments={translationSegments}
                currentMs={currentMs}
                onChangeLang={(lang) => {
                  if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
                  setTranslationLang(lang);
                  setTranslation(null);
                  setTranslationState("idle");
                }}
                onTranslate={() => loadTranslation("POST")}
                onSeek={seekTo}
                speakerLabel={speakerLabel}
                onOpenSpeakerEditor={onOpenSpeakerEditor}
              />
            ) : hasSegments ? (
              <SegmentList
                segments={segments}
                currentMs={currentMs}
                onSeek={seekTo}
                dense={contentTab === "subtitles"}
                speakerLabel={speakerLabel}
                onOpenSpeakerEditor={onOpenSpeakerEditor}
              />
            ) : (
              <p className="whitespace-pre-wrap text-base leading-relaxed">
                {compactCJKSpaces(fallbackText)}
              </p>
            )}
          </div>
        </section>

        <aside className="mt-6 flex min-h-[620px] flex-col border-t border-line bg-card/55 lg:mt-0 lg:min-h-0 lg:border-t-0">
          <div className="shrink-0 border-b border-line bg-paper/90 px-4 py-3.5 sm:px-5">
            <div className="flex w-fit items-center gap-1 rounded-xl bg-ink/5 p-1">
              <TabButton
                active={aiTab === "chat"}
                onClick={() => setAiTab("chat")}
              >
                <span className="inline-flex items-center gap-2">
                  <MessageCircle size={14} />
                  {t("tabChat")}
                </span>
              </TabButton>
              <TabButton
                active={aiTab === "summary"}
                onClick={() => {
                  if (!isPaid) {
                    setUpgradeModal("summary");
                    return;
                  }
                  setAiTab("summary");
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={14} />
                  {safeT(t, "tabSummary", "AI Notes")}
                  {!isPaid ? (
                    <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                      {safeT(t, "proBadge", "Pro")}
                    </span>
                  ) : null}
                </span>
              </TabButton>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {aiTab === "chat" ? (
              <TranscriptChatPanel
                id={id}
                canUpgrade={!isPro}
                fillHeight
                onUpgrade={() => setUpgradeModal("chat")}
              />
            ) : (
              <div className="h-full overflow-y-auto overscroll-contain p-4 sm:p-5">
                <SummaryPanel
                  state={summaryState}
                  summary={summary?.summary ?? ""}
                  error={summaryError}
                  onGenerate={() => loadSummary("POST")}
                />
              </div>
            )}
          </div>
        </aside>
      </div>

      <UpgradePlanModal
        reason={upgradeModal}
        open={upgradeModal !== null}
        checkoutSuccessPath={checkoutSuccessPath}
        onClose={() => setUpgradeModal(null)}
      />
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`transcript-tab rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "transcript-tab-active bg-paper text-accent shadow-sm"
          : "text-ink/60 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

type YouTubeEmbedProps = {
  ref: React.RefObject<HTMLIFrameElement | null>;
  videoId: string;
  onTimeUpdate: (ms: number) => void;
};

function YouTubeEmbed({ ref, videoId, onTimeUpdate }: YouTubeEmbedProps) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!origin) return;

    let cancelled = false;
    let player: YouTubePlayer | null = null;
    let interval: number | null = null;

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !ref.current) return;
        player = new YT.Player(ref.current, {
          events: {
            onReady: () => {
              interval = window.setInterval(() => {
                try {
                  const seconds = player?.getCurrentTime();
                  if (typeof seconds === "number" && Number.isFinite(seconds)) {
                    onTimeUpdate(seconds * 1000);
                  }
                } catch {
                  // YouTube can briefly reject reads while the iframe is loading.
                }
              }, 250);
            },
          },
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      player?.destroy();
    };
  }, [onTimeUpdate, origin, ref, videoId]);

  const src = useMemo(() => {
    const params = new URLSearchParams({
      enablejsapi: "1",
      rel: "0",
      modestbranding: "1",
    });
    if (origin) params.set("origin", origin);
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  }, [origin, videoId]);
  const sourceUrl = useMemo(
    () => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    [videoId]
  );

  return (
    <div className="transcript-media overflow-hidden rounded-2xl border border-line bg-ink">
      <iframe
        ref={ref}
        src={src}
        title="YouTube video player"
        className="aspect-video w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <a
        href={sourceUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Open YouTube video"
        className="sr-only"
      >
        YouTube
      </a>
    </div>
  );
}

function TranslationPanel({
  lang,
  languages,
  state,
  text,
  segments,
  currentMs,
  onChangeLang,
  onTranslate,
  onSeek,
  speakerLabel,
  onOpenSpeakerEditor,
}: {
  lang: TranslationLang;
  languages: readonly TranslationLang[];
  state: TranslationState;
  text: string;
  segments: AaiSegment[];
  currentMs: number;
  onChangeLang: (lang: TranslationLang) => void;
  onTranslate: () => void;
  onSeek: (ms: number) => void;
  speakerLabel: (speaker: string) => string;
  onOpenSpeakerEditor: (speaker: string) => void;
}) {
  const t = useTranslations("Dashboard.viewer");
  const busy = state === "loading" || state === "processing";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="grid gap-1.5">
          <span className="text-[12px] font-medium text-ink/55">
            {safeT(t, "translationLanguageLabel", "Translate to")}
          </span>
          <select
            value={lang}
            onChange={(event) => onChangeLang(event.target.value as TranslationLang)}
            className="h-10 min-w-48 rounded-xl border border-line bg-paper px-3 text-[14px] text-ink outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
          >
            {languages.map((language) => (
              <option key={language} value={language}>
                {safeT(t, `translationLanguages.${language}`, TRANSLATION_LANGUAGE_FALLBACKS[language])}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onTranslate}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-medium text-paper transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-65"
        >
          <Languages size={15} />
          {busy ? safeT(t, "translating", "Translating...") : t("translate")}
        </button>
      </div>

      {state === "loading" || state === "processing" ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink/60">
          {state === "processing"
            ? safeT(t, "translationProcessing", "Generating translation...")
            : safeT(t, "translationLoading", "Translating...")}
        </p>
      ) : state === "error" ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {safeT(t, "translationError", "Translation failed. Please try again.")}
        </p>
      ) : segments.length > 0 ? (
        <SegmentList
          segments={segments}
          currentMs={currentMs}
          onSeek={onSeek}
          dense={false}
          speakerLabel={speakerLabel}
          onOpenSpeakerEditor={onOpenSpeakerEditor}
        />
      ) : text.trim() ? (
        <p className="whitespace-pre-wrap text-base leading-relaxed">
          {compactCJKSpaces(text)}
        </p>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink/60">
          {safeT(t, "translationIdle", "Choose a language, then translate this transcript.")}
        </p>
      )}
    </div>
  );
}

function SummaryPanel({
  state,
  summary,
  error,
  onGenerate,
}: {
  state: SummaryState;
  summary: string;
  error: string | null;
  onGenerate: () => void;
}) {
  const t = useTranslations("Dashboard.viewer");
  const busy = state === "loading" || state === "processing";
  const hasSummary = summary.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[14px] font-medium text-ink">
            {safeT(t, "summaryPanelTitle", "AI notes")}
          </p>
          <p className="mt-1 text-[13px] text-ink/55">
            {safeT(t, "summaryPanelDescription", "Generate a concise overview, key points, and action items.")}
          </p>
        </div>
        {!hasSummary ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-medium text-paper transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-65"
          >
            <Sparkles size={15} />
            {busy ? safeT(t, "summarizing", "Creating AI notes...") : safeT(t, "generateSummary", "Generate AI notes")}
          </button>
        ) : null}
      </div>

      {state === "loading" || state === "processing" ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink/60">
          {safeT(t, "summaryProcessing", "Creating AI notes...")}
        </p>
      ) : state === "error" ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {safeT(t, "summaryError", "AI notes failed. Please try again.")}
          {error ? (
            <span className="mt-2 block whitespace-pre-wrap text-[12px] leading-relaxed text-red-700/80">
              {error}
            </span>
          ) : null}
        </p>
      ) : summary.trim() ? (
        <div className="whitespace-pre-wrap rounded-2xl border border-line bg-card px-5 py-5 text-[15px] leading-7 text-ink/85">
          {summary}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink/60">
          {safeT(t, "summaryIdle", "Generate AI notes when you are ready.")}
        </p>
      )}
    </div>
  );
}

async function readErrorPayload(response: Response): Promise<ErrorPayload | null> {
  try {
    return (await response.json()) as ErrorPayload;
  } catch {
    return null;
  }
}

type SegmentListProps = {
  segments: AaiSegment[];
  currentMs: number;
  onSeek: (ms: number) => void;
  dense: boolean;
  speakerLabel: (speaker: string) => string;
  onOpenSpeakerEditor: (speaker: string) => void;
};

function SegmentList({
  segments,
  currentMs,
  onSeek,
  dense,
  speakerLabel,
  onOpenSpeakerEditor,
}: SegmentListProps) {
  return (
    <div className={dense ? "space-y-1.5" : "space-y-6"}>
      {segments.map((seg, i) => {
        const isActive = currentMs >= seg.start && currentMs < seg.end;
        const speaker = typeof seg.speaker === "string" && seg.speaker.trim()
          ? seg.speaker.trim()
          : null;
        const speakerTone = speaker ? speakerToneFor(speaker) : "";
        return dense ? (
          <button
            key={i}
            onClick={() => onSeek(seg.start)}
            className={`block w-full text-left rounded-lg px-3 py-2 text-[15px] leading-relaxed transition ${
              isActive ? "bg-accent-soft text-ink" : "hover:bg-ink/5 text-ink/85"
            }`}
          >
            <span className="mr-3 inline-flex items-center gap-2 align-baseline">
              <span className="transcript-segment-time inline-block w-12 text-[12px] tabular-nums text-ink/50">
                {fmtTime(seg.start)}
              </span>
              {speaker ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenSpeakerEditor(speaker);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenSpeakerEditor(speaker);
                  }}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${speakerTone}`}
                >
                  {speakerLabel(speaker)}
                </span>
              ) : null}
            </span>
            {compactCJKSpaces(seg.text)}
          </button>
        ) : (
          <div
            key={i}
            className={`-mx-3 rounded-xl px-3 py-2 transition ${
              isActive ? "bg-accent-soft/80" : "hover:bg-ink/[0.03]"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSeek(seg.start)}
                className={`transcript-segment-time text-[13px] tabular-nums font-medium transition ${
                  isActive
                    ? "transcript-segment-time-active text-accent"
                    : "text-accent/70 hover:text-accent"
                }`}
              >
                {fmtTime(seg.start)}
              </button>
              {speaker ? (
                <button
                  type="button"
                  onClick={() => onOpenSpeakerEditor(speaker)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-[0.04em] transition hover:brightness-95 ${speakerTone}`}
                >
                  {speakerLabel(speaker)}
                </button>
              ) : null}
            </div>
            <p
              className={`mt-1 whitespace-pre-line text-base leading-relaxed transition ${
                isActive ? "text-ink" : "text-ink/85"
              }`}
            >
              {compactCJKSpaces(seg.text)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function groupYouTubeTranscriptSegments(segments: AaiSegment[]): AaiSegment[] {
  if (segments.length < 2) return segments;

  const merged: AaiSegment[] = [];
  let current: AaiSegment | null = null;

  for (const segment of segments) {
    const text = normalizeCaptionText(segment.text);
    if (!text) continue;

    const next = { ...segment, text };
    if (!current) {
      current = next;
      continue;
    }

    if (canAppendToYouTubeBlock(current, next)) {
      current = {
        ...current,
        text: appendCaptionText(current.text, next.text),
        end: Math.max(current.end, next.end),
      };
      continue;
    }

    merged.push(current);
    current = next;
  }

  if (current) merged.push(current);
  return merged;
}

function canAppendToYouTubeBlock(current: AaiSegment, next: AaiSegment): boolean {
  const currentSpeaker = current.speaker?.trim() ?? "";
  const nextSpeaker = next.speaker?.trim() ?? "";
  if (currentSpeaker !== nextSpeaker) return false;

  const gapMs = next.start - current.end;
  if (gapMs > 2600) return false;

  const mergedDurationMs = Math.max(next.end, current.end) - current.start;
  if (mergedDurationMs > 18000) return false;

  const mergedTextLength = current.text.length + next.text.length + 1;
  if (mergedTextLength > 520) return false;

  if (endsSentence(current.text) && mergedDurationMs >= 12000) {
    return false;
  }

  return true;
}

function appendCaptionText(current: string, next: string): string {
  const left = current.trimEnd();
  const right = next.trimStart();
  if (!left) return right;
  if (!right) return left;
  const separator = startsDialogueCue(right) ? "\n" : " ";
  return `${left}${separator}${right}`.replace(/[ \t]+/g, " ");
}

function normalizeCaptionText(text: string): string {
  return compactCJKSpaces(text)
    .replace(/\r?\n+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function startsDialogueCue(text: string): boolean {
  return /^>>\s*\S/.test(text.trim());
}

function endsSentence(text: string): boolean {
  return /[.!?。！？…]["')\]]?$/.test(text.trim());
}

function loadYouTubeIframeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeIframeApiPromise) return youtubeIframeApiPromise;

  youtubeIframeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("youtube_iframe_api_unavailable"));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("youtube_iframe_api_failed"));
    document.head.appendChild(script);
  });

  return youtubeIframeApiPromise;
}

type AudioPlayerProps = {
  ref: React.RefObject<HTMLMediaElement | null>;
  url: string;
  isVideo: boolean;
  onTimeUpdate?: (ms: number) => void;
};

function AudioPlayer({ ref, url, isVideo, onTimeUpdate }: AudioPlayerProps) {
  const t = useTranslations("Dashboard.viewer");
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rateIdx, setRateIdx] = useState(1); // SPEEDS index → 1.0x
  const [playbackError, setPlaybackError] = useState(false);
  const refreshedRef = useRef(false);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      const ms = a.currentTime * 1000;
      setCurrent(ms);
      onTimeUpdate?.(ms);
    };
    const onMeta = () => setDuration(a.duration * 1000 || 0);
    const onVol = () => setMuted(a.muted);
    const onRate = () => {
      const idx = SPEEDS.findIndex((s) => Math.abs(s - a.playbackRate) < 0.01);
      if (idx >= 0) setRateIdx(idx);
    };
    const onError = () => {
      if (refreshedRef.current) {
        setPlaybackError(true);
        return;
      }
      refreshedRef.current = true;
      const currentTime = a.currentTime;
      const wasPlaying = !a.paused;
      const playbackRate = a.playbackRate;
      const separator = url.includes("?") ? "&" : "?";
      a.src = `${url}${separator}refresh=${Date.now()}`;
      a.addEventListener("loadedmetadata", () => {
        a.currentTime = Math.min(currentTime, Number.isFinite(a.duration) ? a.duration : currentTime);
        a.playbackRate = playbackRate;
        if (wasPlaying) void a.play().catch(() => setPlaybackError(true));
      }, { once: true });
      a.load();
    };
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("volumechange", onVol);
    a.addEventListener("ratechange", onRate);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("volumechange", onVol);
      a.removeEventListener("ratechange", onRate);
      a.removeEventListener("error", onError);
    };
  }, [ref, onTimeUpdate, url]);

  const togglePlay = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const toggleMute = () => {
    const a = ref.current;
    if (!a) return;
    a.muted = !a.muted;
  };

  const cycleSpeed = () => {
    const a = ref.current;
    if (!a) return;
    const next = (rateIdx + 1) % SPEEDS.length;
    a.playbackRate = SPEEDS[next];
    setRateIdx(next);
  };

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = ref.current;
    if (!a || !duration) return;
    a.currentTime = (Number(e.target.value) / 1000) * (duration / 1000);
  };

  const pct = duration > 0 ? (current / duration) * 1000 : 0;

  return (
    <div>
      <div className="transcript-audio-player flex items-center gap-3 rounded-2xl bg-ink/5 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
        {isVideo ? (
          <video
            ref={ref as React.RefObject<HTMLVideoElement | null>}
            src={url}
            preload="metadata"
            playsInline
            className="hidden"
          />
        ) : (
          <audio
            ref={ref as React.RefObject<HTMLAudioElement | null>}
            src={url}
            preload="metadata"
            className="hidden"
          />
        )}

        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? t("pause") : t("play")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/70 text-paper transition hover:bg-ink"
        >
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>

        <span className="w-12 text-sm tabular-nums text-ink/70">{fmtTime(current)}</span>

        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={pct}
          onChange={onScrub}
          className="flex-1 accent-ink"
        />

        <span className="w-12 text-right text-sm tabular-nums text-ink/70">
          {fmtTime(duration)}
        </span>

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? t("unmute") : t("mute")}
          className="text-ink/60 transition hover:text-ink"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <button
          type="button"
          onClick={cycleSpeed}
          aria-label={t("playbackSpeed")}
          className="w-12 text-sm font-medium tabular-nums text-ink/70 transition hover:text-ink"
        >
          {SPEEDS[rateIdx]}x
        </button>
      </div>
      {playbackError ? (
        <p className="mt-2 text-[13px] text-red-600">
          {safeT(t, "mediaPlaybackUnsupported", "This media format cannot be played in your current browser.")}
        </p>
      ) : null}
    </div>
  );
};

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m.toString().padStart(2, "0")}:${ss}`;
}

const TRANSLATION_LANGUAGE_FALLBACKS: Record<TranslationLang, string> = {
  en: "English",
  zh: "Chinese",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
};

function firstTargetLanguage(sourceLanguage: string | null | undefined): TranslationLang {
  const source = normalizeSourceTranslationLang(sourceLanguage);
  return TRANSLATION_LANGUAGES.find((language) => language !== source) ?? "en";
}

function normalizeSourceTranslationLang(sourceLanguage: string | null | undefined): TranslationLang | null {
  const normalized = sourceLanguage?.trim().toLowerCase().replace("_", "-");
  if (!normalized) return null;
  const baseLanguage = normalized.split("-")[0] ?? "";
  return isTranslationLang(baseLanguage) ? baseLanguage : null;
}

function isTranslationLang(language: string): language is TranslationLang {
  return TRANSLATION_LANGUAGES.some((supported) => supported === language);
}

function safeT(t: ((key: string) => string) & { has?: (key: string) => boolean }, key: string, fallback: string): string {
  try {
    if (typeof t.has === "function" && !t.has(key)) return fallback;
    return t(key);
  } catch {
    return fallback;
  }
}
