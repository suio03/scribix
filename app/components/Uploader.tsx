"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { trackEvent } from "@/lib/analytics";
import { markSignInPending } from "./Track";

const TOOL_SLUG = "transcribe";

type UploaderT = ReturnType<typeof useTranslations<"Dashboard.uploader">>;

const ACCEPT = "audio/*,video/*";
const MAX_BROWSER_VIDEO_BYTES = 1024 * 1024 * 1024;

export type UploadPhase =
  | "idle"
  | "preparing"
  | "extracting"
  | "uploading"
  | "submitting"
  | "polling"
  | "error";

export type UseUploadOpts = {
  signedIn: boolean;
  /** Where to send the user back to after Google sign-in (locale-prefixed path). */
  postSignInPath?: string;
};

export function useUpload({ signedIn, postSignInPath = "/dashboard/new" }: UseUploadOpts) {
  const t = useTranslations("Dashboard.uploader");
  const router = useRouter();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const onPick = useCallback(
    async (
      file: File,
      source: "upload" | "record" = "upload",
      durationSecOverride?: number
    ) => {
      if (!signedIn) {
        markSignInPending();
        await signIn("google", { redirectTo: postSignInPath });
        return;
      }
      setErrorMsg(null);
      setFilename(file.name);
      setPhase("preparing");
      setProgress(0);
      let transcriptId: string | null = null;
      let keepTranscript = false;
      let step = "preparing";

      try {
        const isVideo = file.type.startsWith("video/");
        if (isVideo && file.size > MAX_BROWSER_VIDEO_BYTES) {
          throw new Error(t("videoTooBig"));
        }

        const durationSec =
          durationSecOverride && durationSecOverride > 0
            ? durationSecOverride
            : await readMediaDuration(file);

        let uploadBody: Blob = file;
        let uploadFilename = file.name;
        let uploadMime = file.type || "application/octet-stream";
        let uploadDurationSec = durationSec;
        let initIsVideo = false;

        if (isVideo) {
          step = "extracting audio";
          setPhase("extracting");
          setProgress(0);
          const { extractAudioFromVideo } = await import("@/lib/audio-extractor");
          const { blob, durationSec: extractedDurationSec } = await extractAudioFromVideo(
            file,
            (p) => setProgress(p)
          );
          const ext = blob.type === "audio/wav" ? "wav" : "mp3";
          uploadBody = blob;
          uploadFilename = `${file.name.replace(/\.[^.]+$/, "")}.${ext}`;
          uploadMime = blob.type || (ext === "wav" ? "audio/wav" : "audio/mpeg");
          uploadDurationSec = extractedDurationSec || durationSec;
        }

        // Pre-flight: server validates duration cap + quota before upload.
        const initRes = await fetch("/api/transcripts/init", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: uploadFilename,
            bytes: uploadBody.size,
            mime: uploadMime,
            durationSec: uploadDurationSec,
            isVideo: initIsVideo,
            source,
          }),
        });
        if (!initRes.ok) throw new Error(await readError(initRes, t));
        const init = (await initRes.json()) as {
          transcriptId: string;
          uploadUrl: string;
        };
        transcriptId = init.transcriptId;

        step = "uploading audio";
        setPhase("uploading");
        await uploadWithProgress(init.uploadUrl, uploadBody, (p) => setProgress(p), t);

        step = "submitting transcript";
        setPhase("submitting");
        const startRes = await fetch(`/api/transcripts/${transcriptId}/start`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ durationSecEstimate: uploadDurationSec }),
        });
        if (!startRes.ok) throw new Error(await readError(startRes, t));

        step = "polling transcript";
        setPhase("polling");
        keepTranscript = true;
        const finalStatus = await pollStatus(transcriptId, t);
        if (finalStatus === "completed") {
          trackEvent("transcribe_success", {
            tool_slug: TOOL_SLUG,
            duration_sec: uploadDurationSec || undefined,
          });
          router.push(`/dashboard/transcripts/${transcriptId}`);
        } else {
          throw new Error(t("transcriptionGeneric", { status: finalStatus }));
        }
      } catch (err) {
        console.error("Upload failed", { step, transcriptId, error: serializeError(err) });
        trackEvent("transcribe_fail", {
          tool_slug: TOOL_SLUG,
          error_code: step,
          error_message: errorSummary(err),
        });
        const message = uploadErrorMessage(err, step, t);
        if (message === "persist_failed") {
          keepTranscript = true;
        }
        if (transcriptId && !keepTranscript) {
          await cleanupTranscript(transcriptId);
        }
        setPhase("error");
        setErrorMsg(message);
      }
    },
    [router, signedIn, postSignInPath, t]
  );

  return { phase, progress, errorMsg, filename, onPick };
}

/** Plain, dashboard-styled drag/drop uploader. */
export function Uploader(props: UseUploadOpts) {
  const t = useTranslations("Dashboard.uploader");
  const { phase, progress, errorMsg, filename, onPick } = useUpload(props);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onPick(file);
      }}
      className={`rounded-2xl border border-dashed p-10 text-center transition ${
        dragOver ? "border-accent bg-accent/5" : "border-line"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />

      {phase === "idle" || phase === "error" ? (
        <>
          <p className="text-base font-medium">{t("dropPrompt")}</p>
          <p className="mt-1 text-sm text-ink/60">{t("limits")}</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-6 rounded-full bg-ink px-5 py-2 text-[13px] font-medium text-paper hover:bg-accent"
          >
            {t("choose")}
          </button>
          {errorMsg && <p className="mt-4 text-sm text-red-600">{errorMsg}</p>}
        </>
      ) : (
        <ProgressView phase={phase} progress={progress} filename={filename} />
      )}
    </div>
  );
}

export function ProgressView({
  phase,
  progress,
  filename,
}: {
  phase: UploadPhase;
  progress: number;
  filename: string | null;
}) {
  const t = useTranslations("Dashboard.uploader");
  const label =
    phase === "preparing"
      ? t("phasePreparing")
      : phase === "extracting"
      ? t("phaseExtracting", { percent: Math.round(progress * 100) })
      : phase === "uploading"
      ? t("phaseUploading", { percent: Math.round(progress * 100) })
      : phase === "submitting"
      ? t("phaseSubmitting")
      : phase === "polling"
      ? t("phaseTranscribing")
      : "";
  const bar =
    phase === "uploading" || phase === "extracting"
      ? progress
      : phase === "polling"
      ? null
      : 1;
  return (
    <div className="space-y-3">
      {filename && <p className="text-sm text-ink/70">{filename}</p>}
      <p className="text-base font-medium">{label}</p>
      <div className="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-ink/10">
        {bar === null ? (
          <div className="h-full animate-pulse bg-accent" style={{ width: "30%" }} />
        ) : (
          <div className="h-full bg-accent transition-[width]" style={{ width: `${bar * 100}%` }} />
        )}
      </div>
    </div>
  );
}

export const UPLOAD_ACCEPT = ACCEPT;

async function readMediaDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  const tag = file.type.startsWith("video/") ? "video" : "audio";
  const el = document.createElement(tag);
  el.preload = "metadata";
  el.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      el.addEventListener("loadedmetadata", () => resolve(), { once: true });
      el.addEventListener("error", () => reject(new Error("cannot_read_metadata")), {
        once: true,
      });
    });
    return Number.isFinite(el.duration) ? el.duration : 0;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const UPLOAD_STALL_MS = 90_000;
const UPLOAD_MAX_ATTEMPTS = 2;

function uploadWithProgress(
  url: string,
  file: Blob,
  onProgress: (frac: number) => void,
  t: UploaderT
): Promise<void> {
  const attempt = (n: number): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let lastTick = Date.now();
      let lastLoaded = 0;
      const stallTimer = setInterval(() => {
        if (Date.now() - lastTick > UPLOAD_STALL_MS) {
          clearInterval(stallTimer);
          xhr.abort();
          reject(new Error("upload_stalled"));
        }
      }, 5_000);
      const done = () => clearInterval(stallTimer);

      xhr.open("PUT", url);
      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return;
        if (e.loaded !== lastLoaded) {
          lastLoaded = e.loaded;
          lastTick = Date.now();
        }
        onProgress(e.loaded / e.total);
      });
      xhr.addEventListener("load", () => {
        done();
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText.slice(0, 200)}`));
      });
      xhr.addEventListener("error", () => {
        done();
        reject(new Error(t("uploadNetworkError")));
      });
      xhr.addEventListener("abort", () => done());
      xhr.send(file);
    }).catch((err) => {
      const retryable =
        err instanceof Error &&
        (err.message === "upload_stalled" || err.message === t("uploadNetworkError"));
      if (retryable && n < UPLOAD_MAX_ATTEMPTS) {
        onProgress(0);
        return attempt(n + 1);
      }
      throw err;
    });

  return attempt(1);
}

async function pollStatus(id: string, t: UploaderT): Promise<"completed" | "error"> {
  while (true) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`/api/transcripts/${id}/status`);
    if (!res.ok) throw new Error(await readError(res, t));
    const { status, error } = (await res.json()) as { status: string; error: string | null };
    if (status === "completed") return "completed";
    if (status === "error") throw new Error(error ?? t("transcriptionFailed"));
  }
}

async function cleanupTranscript(id: string): Promise<void> {
  try {
    await fetch(`/api/transcripts/${id}`, { method: "DELETE" });
  } catch {
    // Best-effort cleanup only; preserve the original upload error for the user.
  }
}

function errorSummary(err: unknown): string {
  const raw =
    err instanceof Error ? err.message :
    typeof err === "string" ? err :
    err == null ? "unknown" :
    String(err);
  return raw
    .replace(/https?:\/\/\S+/gi, "<url>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "<token>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
    if (err.cause !== undefined) out.cause = serializeError(err.cause);
    for (const key of Object.keys(err)) {
      out[key] = (err as unknown as Record<string, unknown>)[key];
    }
    return out;
  }
  if (typeof err === "object" && err !== null) return { ...err };
  return { value: String(err) };
}

function uploadErrorMessage(err: unknown, step: string, t: UploaderT): string {
  if (err instanceof Error && err.message === "cannot_read_metadata") return t("cannotReadMetadata");
  if (err instanceof Error && err.message) return err.message;
  if (err instanceof DOMException && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return t("uploadFallback", { step });
}

async function readError(res: Response, t: UploaderT): Promise<string> {
  try {
    const j = (await res.json()) as {
      error?: string;
      maxBytes?: number;
      maxSec?: number;
      remainingMin?: number;
      capMin?: number;
      neededMin?: number;
    };
    switch (j.error) {
      case "file_too_large": {
        const mb = j.maxBytes ? Math.floor(j.maxBytes / (1024 * 1024)) : null;
        return mb
          ? t("fileTooLargeWithCap", { mb })
          : t("fileTooLarge");
      }
      case "duration_exceeds_tier": {
        const min = j.maxSec ? Math.floor(j.maxSec / 60) : null;
        return min
          ? t("durationExceedsTierWithCap", { min })
          : t("durationExceedsTier");
      }
      case "no_quota":
        return j.capMin
          ? t("noQuotaWithCap", { capMin: j.capMin })
          : t("noQuota");
      case "insufficient_quota":
        return t("insufficientQuota", {
          neededMin: j.neededMin ?? "?",
          remainingMin: j.remainingMin ?? 0,
        });
      case "aai_submit_failed":
        return t("aaiSubmitFailed");
      default:
        return j.error ?? t("requestFailed", { status: res.status });
    }
  } catch {
    return t("requestFailed", { status: res.status });
  }
}
