"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Trash2, Upload } from "lucide-react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { ProgressView, UploadErrorHelp, useUpload, type UseUploadOpts } from "./Uploader";
import { markSignInPending } from "./Track";

const MAX_RECORDING_SEC = 30 * 60;

type RecState = "idle" | "recording" | "paused" | "reviewing";

export function Recorder(props: UseUploadOpts) {
  const t = useTranslations("Dashboard.recorder");
  const { phase, progress, uploadError, errorMsg, filename, onPick, retry } = useUpload(props);
  const [recState, setRecState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [recError, setRecError] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSegmentStartedAtRef = useRef<number | null>(null);
  const accumulatedRecordingMsRef = useRef(0);
  const cancelRequestedRef = useRef(false);

  useEffect(() => () => stopAll(), []);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function stopAll() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    chunksRef.current = [];
    activeSegmentStartedAtRef.current = null;
    accumulatedRecordingMsRef.current = 0;
  }

  function activeRecordingMs(now = performance.now()): number {
    const activeSegmentStartedAt = activeSegmentStartedAtRef.current;
    const activeSegmentMs =
      activeSegmentStartedAt === null
        ? 0
        : Math.max(0, now - activeSegmentStartedAt);
    return accumulatedRecordingMsRef.current + activeSegmentMs;
  }

  function startTimer(rec: MediaRecorder) {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      const elapsedSec = Math.min(
        MAX_RECORDING_SEC,
        Math.floor(activeRecordingMs() / 1000)
      );
      setSeconds(elapsedSec);
      if (
        elapsedSec >= MAX_RECORDING_SEC &&
        rec.state === "recording"
      ) {
        rec.stop();
      }
    }, 1000);
  }

  async function start() {
    setRecError(null);
    if (!props.signedIn) {
      markSignInPending();
      await signIn("google", { redirectTo: props.postSignInPath ?? "/dashboard/new" });
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error(t("unsupported"));
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      cancelRequestedRef.current = false;
      recRef.current = rec;
      chunksRef.current = [];
      rec.addEventListener("dataavailable", (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      });
      rec.addEventListener("stop", async () => {
        if (cancelRequestedRef.current) {
          cancelRequestedRef.current = false;
          stopAll();
          return;
        }
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes("mp4") ? "m4a" : "webm";
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const file = new File([blob], `recording-${ts}.${ext}`, { type });
        const durationSec = Math.max(
          1,
          Math.min(
            MAX_RECORDING_SEC,
            Math.round(activeRecordingMs() / 1000)
          )
        );
        stopAll();
        setRecordedFile(file);
        setRecordedDurationSec(durationSec);
        setPreviewUrl(URL.createObjectURL(file));
        setRecState("reviewing");
      });
      accumulatedRecordingMsRef.current = 0;
      activeSegmentStartedAtRef.current = performance.now();
      rec.start(1000);
      setRecState("recording");
      setSeconds(0);
      startTimer(rec);
    } catch (err) {
      setRecError(err instanceof Error ? err.message : t("micDenied"));
      stopAll();
      setRecState("idle");
    }
  }

  function stop() {
    recRef.current?.stop();
  }

  function pause() {
    if (recRef.current?.state !== "recording") return;
    const now = performance.now();
    const activeSegmentStartedAt = activeSegmentStartedAtRef.current;
    if (activeSegmentStartedAt !== null) {
      accumulatedRecordingMsRef.current += Math.max(
        0,
        now - activeSegmentStartedAt
      );
      activeSegmentStartedAtRef.current = null;
    }
    recRef.current.pause();
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setSeconds(
      Math.min(
        MAX_RECORDING_SEC,
        Math.floor(accumulatedRecordingMsRef.current / 1000)
      )
    );
    setRecState("paused");
  }

  function resume() {
    if (recRef.current?.state !== "paused") return;
    recRef.current.resume();
    activeSegmentStartedAtRef.current = performance.now();
    startTimer(recRef.current);
    setRecState("recording");
  }

  function cancel() {
    if (recRef.current && recRef.current.state !== "inactive") {
      cancelRequestedRef.current = true;
      recRef.current.stop();
    }
    stopAll();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedFile(null);
    setRecordedDurationSec(0);
    setSeconds(0);
    setRecState("idle");
  }

  async function uploadRecording() {
    if (!recordedFile) return;
    const file = recordedFile;
    const duration = recordedDurationSec;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedFile(null);
    setRecState("idle");
    await onPick(file, "record", duration);
  }

  if (phase !== "idle" && phase !== "error") {
    return (
      <div className="rounded-2xl border border-line p-10 text-center">
        <ProgressView phase={phase} progress={progress} filename={filename} />
      </div>
    );
  }

  const recording = recState === "recording";
  const paused = recState === "paused";

  if (recState === "reviewing" && recordedFile && previewUrl) {
    return (
      <div className="rounded-2xl border border-line p-10 text-center">
        <p className="text-base font-medium">{t("review")}</p>
        <p className="mt-1 font-mono text-sm tabular-nums text-ink/60">
          {formatTime(recordedDurationSec)}
        </p>
        <audio controls src={previewUrl} className="mx-auto mt-5 w-full max-w-md" />
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={cancel}
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium"
          >
            <Trash2 size={15} />
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => void uploadRecording()}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent"
          >
            <Upload size={15} />
            {t("upload")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line p-10 text-center">
      <button
        type="button"
        onClick={recording || paused ? stop : start}
        aria-label={recording || paused ? t("stop") : t("start")}
        className={`relative inline-grid size-24 place-items-center rounded-full border-4 transition ${
          recording || paused
            ? "border-rec/30 bg-rec text-paper"
            : "border-line bg-card text-ink hover:border-accent hover:text-accent"
        }`}
      >
        {recording || paused ? (
          <Square size={26} strokeWidth={2} fill="currentColor" />
        ) : (
          <Mic size={28} strokeWidth={1.6} />
        )}
        {recording && (
          <span className="absolute inset-0 -m-2 animate-ping rounded-full border-2 border-rec/40" />
        )}
      </button>
      {recording || paused ? (
        <button
          type="button"
          onClick={paused ? resume : pause}
          className="ml-3 inline-grid size-11 place-items-center rounded-full border border-line text-ink hover:border-accent hover:text-accent"
          aria-label={paused ? t("resume") : t("pause")}
        >
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
      ) : null}
      <p className="mt-6 font-mono text-base font-medium tabular-nums">
        {formatTime(seconds)}
      </p>
      <p className="mt-1 text-sm text-ink/60">
        {recording
          ? t("recording", { min: MAX_RECORDING_SEC / 60 })
          : paused
          ? t("paused")
          : t("tapToRecord", { min: MAX_RECORDING_SEC / 60 })}
      </p>
      {(recError || (errorMsg && !uploadError)) && (
        <p className="mt-4 text-sm text-red-600">{recError ?? errorMsg}</p>
      )}
      <UploadErrorHelp
        error={uploadError}
        onRetry={retry}
        checkoutSuccessPath={props.checkoutSuccessPath ?? props.postSignInPath ?? "/dashboard/new"}
      />
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
