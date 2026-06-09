"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Languages, MoreVertical, Pause, Play, Sparkles, Users, Volume2, VolumeX, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AaiSegment } from "@/lib/aai";
import { compactCJKSpaces } from "@/lib/transcript-format";
import { PaddleCheckoutButton } from "./PaddleCheckoutButton";
import { displaySpeakerName, speakerToneFor, type SpeakerNames } from "./speakerDisplay";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
const TRANSLATION_LANGUAGES = ["en", "zh", "es", "fr", "de", "ja", "ko", "pt", "it", "nl"] as const;

type Tab = "transcript" | "subtitles" | "translation" | "summary";
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

type Props = {
  id: string;
  audioUrl: string | null;
  utterances: AaiSegment[];
  paragraphs: AaiSegment[];
  sentences: AaiSegment[];
  fallbackText: string;
  sourceLanguage: string | null;
  speakerNames: SpeakerNames;
  speakers: string[];
  isPaid: boolean;
  checkoutSuccessPath: string;
  onOpenSpeakerEditor: (speaker?: string) => void;
};

export function TranscriptViewer({
  id,
  audioUrl,
  utterances,
  paragraphs,
  sentences,
  fallbackText,
  sourceLanguage,
  speakerNames,
  speakers,
  isPaid,
  checkoutSuccessPath,
  onOpenSpeakerEditor,
}: Props) {
  const t = useTranslations("Dashboard.viewer");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const summaryPollTimerRef = useRef<number | null>(null);
  const requestRef = useRef(0);
  const summaryRequestRef = useRef(0);
  const [tab, setTab] = useState<Tab>("transcript");
  const [currentMs, setCurrentMs] = useState(0);
  const [translationLang, setTranslationLang] = useState<TranslationLang>(() =>
    firstTargetLanguage(sourceLanguage)
  );
  const [translationState, setTranslationState] = useState<TranslationState>("idle");
  const [translation, setTranslation] = useState<TranslationPayload | null>(null);
  const [summaryState, setSummaryState] = useState<SummaryState>("idle");
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<"translation" | "summary" | null>(null);

  const seekTo = (ms: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = ms / 1000;
    a.play().catch(() => {});
  };

  const transcriptSegments = utterances.length > 0 ? utterances : paragraphs;
  const sourceTranslationLang = normalizeSourceTranslationLang(sourceLanguage);
  const availableTranslationLanguages = useMemo(
    () => TRANSLATION_LANGUAGES.filter((language) => language !== sourceTranslationLang),
    [sourceTranslationLang]
  );
  const translationSegments = translation?.utterances ?? [];
  const segments = tab === "transcript" ? transcriptSegments : sentences;
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
    if (tab !== "translation" || !isPaid) return;
    void loadTranslation("GET");
  }, [isPaid, tab, translationLang]);

  useEffect(() => {
    if (tab !== "summary" || !isPaid) return;
    void loadSummary("GET");
  }, [isPaid, tab]);

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
      if (!response.ok) throw new Error(`summary_${response.status}`);

      const json = (await response.json()) as SummaryPayload;
      setSummary(json);
      setSummaryState("ready");
    } catch {
      if (summaryRequestRef.current === requestId) setSummaryState("error");
    }
  }

  return (
    <div className="space-y-6">
      {audioUrl && (
        <AudioPlayer ref={audioRef} url={audioUrl} onTimeUpdate={setCurrentMs} />
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex w-fit flex-wrap items-center gap-1 rounded-2xl bg-ink/5 p-1">
          <TabButton active={tab === "transcript"} onClick={() => setTab("transcript")}>
            {t("tabTranscript")}
          </TabButton>
          <TabButton active={tab === "subtitles"} onClick={() => setTab("subtitles")}>
            {t("tabSubtitles")}
          </TabButton>
          <TabButton
            active={tab === "translation"}
            onClick={() => {
              if (!isPaid) {
                setUpgradeModal("translation");
                return;
              }
              setTab("translation");
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
          <TabButton
            active={tab === "summary"}
            onClick={() => {
              if (!isPaid) {
                setUpgradeModal("summary");
                return;
              }
              setTab("summary");
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              {safeT(t, "tabSummary", "Summary")}
              {!isPaid ? (
                <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                  {safeT(t, "proBadge", "Pro")}
                </span>
              ) : null}
            </span>
          </TabButton>
        </div>
        <div className="flex items-center gap-1">
          {speakers.length > 0 ? (
            <button
              type="button"
              onClick={() => onOpenSpeakerEditor()}
              title={t("editSpeakersTitle")}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-ink/65 transition hover:bg-ink/5 hover:text-ink"
            >
              <Users size={14} />
              {t("speakersCount", { count: speakers.length })}
            </button>
          ) : null}
          <button
            type="button"
            disabled
            title={t("moreSoon")}
            aria-label={t("more")}
            className="rounded-md p-1.5 text-ink/40 opacity-70 cursor-not-allowed"
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {tab === "translation" ? (
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
      ) : tab === "summary" ? (
        <SummaryPanel
          state={summaryState}
          summary={summary?.summary ?? ""}
          onGenerate={() => loadSummary("POST")}
        />
      ) : hasSegments ? (
        <SegmentList
          segments={segments}
          currentMs={currentMs}
          onSeek={seekTo}
          dense={tab === "subtitles"}
          speakerLabel={speakerLabel}
          onOpenSpeakerEditor={onOpenSpeakerEditor}
        />
      ) : (
        <p className="whitespace-pre-wrap text-base leading-relaxed">
          {compactCJKSpaces(fallbackText)}
        </p>
      )}

      <PaidFeatureUpgradeModal
        feature={upgradeModal}
        open={upgradeModal !== null}
        checkoutSuccessPath={checkoutSuccessPath}
        onClose={() => setUpgradeModal(null)}
      />
    </div>
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
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active ? "bg-paper text-accent shadow-sm" : "text-ink/60 hover:text-ink"
      }`}
    >
      {children}
    </button>
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
  onGenerate,
}: {
  state: SummaryState;
  summary: string;
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
            {safeT(t, "summaryPanelTitle", "AI summary")}
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
            {busy ? safeT(t, "summarizing", "Summarizing...") : safeT(t, "generateSummary", "Generate summary")}
          </button>
        ) : null}
      </div>

      {state === "loading" || state === "processing" ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink/60">
          {safeT(t, "summaryProcessing", "Summarizing...")}
        </p>
      ) : state === "error" ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {safeT(t, "summaryError", "Summary failed. Please try again.")}
        </p>
      ) : summary.trim() ? (
        <div className="whitespace-pre-wrap rounded-2xl border border-line bg-card px-5 py-5 text-[15px] leading-7 text-ink/85">
          {summary}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink/60">
          {safeT(t, "summaryIdle", "Generate a summary when you are ready.")}
        </p>
      )}
    </div>
  );
}

function PaidFeatureUpgradeModal({
  feature,
  open,
  checkoutSuccessPath,
  onClose,
}: {
  feature: "translation" | "summary" | null;
  open: boolean;
  checkoutSuccessPath: string;
  onClose: () => void;
}) {
  const t = useTranslations("Dashboard.viewer");
  if (!open) return null;
  const isSummary = feature === "summary";

  const buttonClass =
    "inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-ink bg-ink px-4 text-[13px] font-medium text-paper transition hover:bg-ink/90";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paid-feature-upgrade-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4 py-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[520px] rounded-2xl border border-line bg-paper p-5 shadow-[0_30px_80px_-35px_rgba(14,13,11,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="paid-feature-upgrade-title" className="text-[18px] font-semibold text-ink">
              {isSummary
                ? safeT(t, "upgradeSummaryTitle", "Unlock AI summary")
                : safeT(t, "upgradeTranslationTitle", "Unlock AI translation")}
            </h2>
            <p className="mt-1.5 text-[14px] leading-6 text-ink/62">
              {isSummary
                ? safeT(
                    t,
                    "upgradeSummaryBody",
                    "Summary is included in Starter and Pro. Upgrade to summarize completed transcripts."
                  )
                : safeT(
                    t,
                    "upgradeTranslationBody",
                    "Translation is included in Starter and Pro. Upgrade to translate completed transcripts into supported languages."
                  )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={safeT(t, "closeUpgrade", "Close upgrade modal")}
            className="inline-grid size-9 shrink-0 place-items-center rounded-lg text-ink/55 transition hover:bg-ink/5 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <PaddleCheckoutButton
            tier="basic"
            cycle="monthly"
            signedIn={true}
            checkoutSuccessPath={checkoutSuccessPath}
            className={buttonClass}
          >
            {safeT(t, "upgradeStarter", "Starter")}
          </PaddleCheckoutButton>
          <PaddleCheckoutButton
            tier="pro"
            cycle="monthly"
            signedIn={true}
            checkoutSuccessPath={checkoutSuccessPath}
            className={`${buttonClass} border-accent bg-accent hover:bg-accent/90`}
          >
            {safeT(t, "upgradePro", "Pro")}
          </PaddleCheckoutButton>
        </div>
      </div>
    </div>
  );
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
              <span className="inline-block w-12 text-[12px] tabular-nums text-ink/50">
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
          <div key={i}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSeek(seg.start)}
                className={`text-[13px] tabular-nums font-medium transition ${
                  isActive ? "text-accent" : "text-accent/70 hover:text-accent"
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
              className={`mt-1 text-base leading-relaxed transition ${
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

type AudioPlayerProps = {
  ref: React.RefObject<HTMLAudioElement | null>;
  url: string;
  onTimeUpdate?: (ms: number) => void;
};

function AudioPlayer({ ref, url, onTimeUpdate }: AudioPlayerProps) {
  const t = useTranslations("Dashboard.viewer");
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rateIdx, setRateIdx] = useState(1); // SPEEDS index → 1.0x

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
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("volumechange", onVol);
    a.addEventListener("ratechange", onRate);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("volumechange", onVol);
      a.removeEventListener("ratechange", onRate);
    };
  }, [ref, onTimeUpdate]);

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
    <div className="flex items-center gap-3 rounded-2xl bg-ink/5 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
      <audio ref={ref} src={url} preload="metadata" className="hidden" />

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
