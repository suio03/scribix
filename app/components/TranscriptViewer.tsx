"use client";

import { useEffect, useRef, useState } from "react";
import { Languages, MoreVertical, Pause, Play, Sparkles, Users, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AaiSegment } from "@/lib/aai";
import { compactCJKSpaces } from "@/lib/transcript-format";
import { displaySpeakerName, speakerToneFor, type SpeakerNames } from "./speakerDisplay";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

type Tab = "transcript" | "subtitles";

type Props = {
  audioUrl: string | null;
  utterances: AaiSegment[];
  paragraphs: AaiSegment[];
  sentences: AaiSegment[];
  fallbackText: string;
  speakerNames: SpeakerNames;
  speakers: string[];
  onOpenSpeakerEditor: (speaker?: string) => void;
};

export function TranscriptViewer({
  audioUrl,
  utterances,
  paragraphs,
  sentences,
  fallbackText,
  speakerNames,
  speakers,
  onOpenSpeakerEditor,
}: Props) {
  const t = useTranslations("Dashboard.viewer");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tab, setTab] = useState<Tab>("transcript");
  const [currentMs, setCurrentMs] = useState(0);

  const seekTo = (ms: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = ms / 1000;
    a.play().catch(() => {});
  };

  const transcriptSegments = utterances.length > 0 ? utterances : paragraphs;
  const segments = tab === "transcript" ? transcriptSegments : sentences;
  const hasSegments = segments.length > 0;
  const speakerLabel = (speaker: string) =>
    displaySpeakerName(speaker, speakerNames, (id) => t("speakerLabel", { speaker: id }));

  return (
    <div className="space-y-6">
      {audioUrl && (
        <AudioPlayer ref={audioRef} url={audioUrl} onTimeUpdate={setCurrentMs} />
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full bg-ink/5 p-1 w-fit">
          <TabButton active={tab === "transcript"} onClick={() => setTab("transcript")}>
            {t("tabTranscript")}
          </TabButton>
          <TabButton active={tab === "subtitles"} onClick={() => setTab("subtitles")}>
            {t("tabSubtitles")}
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
            title={t("translateSoon")}
            aria-label={t("translate")}
            className="rounded-md p-1.5 text-ink/40 opacity-70 cursor-not-allowed"
          >
            <Languages size={16} />
          </button>
          <button
            type="button"
            disabled
            title={t("summarySoon")}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-ink/40 opacity-70 cursor-not-allowed"
          >
            <Sparkles size={14} />
            {t("summary")}
          </button>
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

      {hasSegments ? (
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
