"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { ProgressView, useUpload, type UseUploadOpts } from "./Uploader";

const MAX_RECORDING_SEC = 30 * 60;

type RecState = "idle" | "recording";

export function Recorder(props: UseUploadOpts) {
  const { phase, progress, errorMsg, filename, onPick } = useUpload(props);
  const [recState, setRecState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [recError, setRecError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => () => stopAll(), []);

  function stopAll() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    chunksRef.current = [];
  }

  async function start() {
    setRecError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recRef.current = rec;
      chunksRef.current = [];
      rec.addEventListener("dataavailable", (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      });
      rec.addEventListener("stop", async () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes("mp4") ? "m4a" : "webm";
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const file = new File([blob], `recording-${ts}.${ext}`, { type });
        const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        stopAll();
        setRecState("idle");
        setSeconds(0);
        await onPick(file, "record", durationSec);
      });
      startedAtRef.current = Date.now();
      rec.start(1000);
      setRecState("recording");
      setSeconds(0);
      tickRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_RECORDING_SEC && rec.state === "recording") rec.stop();
          return next;
        });
      }, 1000);
    } catch (err) {
      setRecError(err instanceof Error ? err.message : "Microphone access denied.");
      stopAll();
      setRecState("idle");
    }
  }

  function stop() {
    recRef.current?.stop();
  }

  if (phase !== "idle" && phase !== "error") {
    return (
      <div className="rounded-2xl border border-line p-10 text-center">
        <ProgressView phase={phase} progress={progress} filename={filename} />
      </div>
    );
  }

  const recording = recState === "recording";

  return (
    <div className="rounded-2xl border border-line p-10 text-center">
      <button
        type="button"
        onClick={recording ? stop : start}
        aria-label={recording ? "Stop recording" : "Start recording"}
        className={`relative inline-grid size-24 place-items-center rounded-full border-4 transition ${
          recording
            ? "border-rec/30 bg-rec text-paper"
            : "border-line bg-card text-ink hover:border-accent hover:text-accent"
        }`}
      >
        {recording ? (
          <Square size={26} strokeWidth={2} fill="currentColor" />
        ) : (
          <Mic size={28} strokeWidth={1.6} />
        )}
        {recording && (
          <span className="absolute inset-0 -m-2 animate-ping rounded-full border-2 border-rec/40" />
        )}
      </button>
      <p className="mt-6 font-mono text-base font-medium tabular-nums">
        {formatTime(seconds)}
      </p>
      <p className="mt-1 text-sm text-ink/60">
        {recording ? `Recording — auto-stops at ${MAX_RECORDING_SEC / 60} min` : `Tap to record · up to ${MAX_RECORDING_SEC / 60} min`}
      </p>
      {(recError || errorMsg) && (
        <p className="mt-4 text-sm text-red-600">{recError ?? errorMsg}</p>
      )}
    </div>
  );
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}
