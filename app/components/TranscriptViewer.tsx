"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { AaiSegment } from "@/lib/aai";
import { compactCJKSpaces } from "@/lib/transcript-format";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

type Tab = "transcript" | "subtitles";

type Props = {
  audioUrl: string | null;
  paragraphs: AaiSegment[];
  sentences: AaiSegment[];
  fallbackText: string;
};

export function TranscriptViewer({ audioUrl, paragraphs, sentences, fallbackText }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tab, setTab] = useState<Tab>("transcript");
  const [currentMs, setCurrentMs] = useState(0);

  const seekTo = (ms: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = ms / 1000;
    a.play().catch(() => {});
  };

  const segments = tab === "transcript" ? paragraphs : sentences;
  const hasSegments = segments.length > 0;

  return (
    <div className="space-y-6">
      {audioUrl && (
        <AudioPlayer ref={audioRef} url={audioUrl} onTimeUpdate={setCurrentMs} />
      )}

      <div className="flex items-center gap-1 rounded-full bg-ink/5 p-1 w-fit">
        <TabButton active={tab === "transcript"} onClick={() => setTab("transcript")}>
          Transcript
        </TabButton>
        <TabButton active={tab === "subtitles"} onClick={() => setTab("subtitles")}>
          Subtitles
        </TabButton>
      </div>

      {hasSegments ? (
        <SegmentList
          segments={segments}
          currentMs={currentMs}
          onSeek={seekTo}
          dense={tab === "subtitles"}
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
};

function SegmentList({ segments, currentMs, onSeek, dense }: SegmentListProps) {
  return (
    <div className={dense ? "space-y-1.5" : "space-y-6"}>
      {segments.map((seg, i) => {
        const isActive = currentMs >= seg.start && currentMs < seg.end;
        return dense ? (
          <button
            key={i}
            onClick={() => onSeek(seg.start)}
            className={`block w-full text-left rounded-lg px-3 py-2 text-[15px] leading-relaxed transition ${
              isActive ? "bg-accent-soft text-ink" : "hover:bg-ink/5 text-ink/85"
            }`}
          >
            <span className="mr-3 inline-block w-12 text-[12px] tabular-nums text-ink/50">
              {fmtTime(seg.start)}
            </span>
            {compactCJKSpaces(seg.text)}
          </button>
        ) : (
          <div key={i}>
            <button
              type="button"
              onClick={() => onSeek(seg.start)}
              className={`text-[13px] tabular-nums font-medium transition ${
                isActive ? "text-accent" : "text-accent/70 hover:text-accent"
              }`}
            >
              {fmtTime(seg.start)}
            </button>
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
        aria-label={playing ? "Pause" : "Play"}
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
        aria-label={muted ? "Unmute" : "Mute"}
        className="text-ink/60 transition hover:text-ink"
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <button
        type="button"
        onClick={cycleSpeed}
        aria-label="Playback speed"
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
