"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { trackEvent } from "@/lib/analytics";
import type { Tier } from "@/lib/plans";
import { UpgradePlanModal } from "./UpgradePlanModal";
import { markSignInPending } from "./Track";

const DEFAULT_TOOL_SLUG = "transcribe";

type UploaderT = ReturnType<typeof useTranslations<"Dashboard.uploader">>;

const ACCEPT = "audio/*,video/*";
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
const MAX_UPLOAD_LABEL = "1 GB";

export type UploadPhase =
  | "idle"
  | "preparing"
  | "extracting"
  | "uploading"
  | "submitting"
  | "polling"
  | "error";

type UploadErrorType = "technical" | "product_limit" | "quota" | "auth";
type UploadHelp = "extract_audio";

export type UploadErrorDetail = {
  message: string;
  code: string;
  type: UploadErrorType;
  help?: UploadHelp;
  retryable?: boolean;
};

class UploadFlowError extends Error {
  code: string;
  type: UploadErrorType;
  help?: UploadHelp;
  retryable: boolean;

  constructor(
    code: string,
    message: string,
    type: UploadErrorType = "technical",
    opts: { help?: UploadHelp; retryable?: boolean } = {}
  ) {
    super(message);
    this.name = "UploadFlowError";
    this.code = code;
    this.type = type;
    this.help = opts.help;
    this.retryable = opts.retryable ?? false;
  }
}

class UploadTransportError extends Error {
  constructor(
    public code: "upload_network_error" | "upload_stalled" | "upload_http_error",
    message: string,
    public attempts: number,
    public elapsedMs: number,
    public status?: number
  ) {
    super(message);
    this.name = "UploadTransportError";
  }
}

export type UseUploadOpts = {
  signedIn: boolean;
  /** Current account tier, used only for display copy in shared upload surfaces. */
  tier?: Tier;
  /** Where to send the user back to after Google sign-in (locale-prefixed path). */
  postSignInPath?: string;
  /** Where to return after Paddle checkout. Defaults to postSignInPath for upload surfaces. */
  checkoutSuccessPath?: string;
  /** Restrict uploads to audio files and skip the video extraction path. */
  audioOnly?: boolean;
  /** Analytics tool identifier for attribution across shared upload surfaces. */
  toolSlug?: string;
};

export function useUpload({
  signedIn,
  postSignInPath = "/dashboard/new",
  audioOnly = false,
  toolSlug = DEFAULT_TOOL_SLUG,
}: UseUploadOpts) {
  const t = useTranslations("Dashboard.uploader");
  const router = useRouter();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<UploadErrorDetail | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const lastPickRef = useRef<{
    file: File;
    source: "upload" | "record";
    durationSecOverride?: number;
  } | null>(null);

  const onPick = useCallback(
    async (
      file: File,
      source: "upload" | "record" = "upload",
      durationSecOverride?: number
    ) => {
      lastPickRef.current = { file, source, durationSecOverride };
      const inputType = getUploadInputType(file);

      if (audioOnly && inputType !== "audio") {
        setFilename(file.name);
        setPhase("error");
        const error = makeUploadError("audio_only_file_type", t("audioOnly"), "product_limit");
        setUploadError(error);
        trackEvent("transcribe_fail", {
          tool_slug: toolSlug,
          source,
          input_type: inputType,
          error_type: error.type,
          error_code: error.code,
          error_message: error.message,
        });
        return;
      }

      if (inputType === "video" && file.size > MAX_UPLOAD_BYTES) {
        const error = makeUploadError(
          "video_file_too_large",
          t("videoTooBig", { size: MAX_UPLOAD_LABEL }),
          "product_limit",
          { help: "extract_audio" }
        );
        setFilename(file.name);
        setPhase("error");
        setUploadError(error);
        trackEvent("transcribe_fail", {
          tool_slug: toolSlug,
          source,
          input_type: inputType,
          error_type: error.type,
          error_code: error.code,
          error_message: error.message,
        });
        return;
      }

      if (inputType === "audio" && file.size > MAX_UPLOAD_BYTES) {
        const error = makeUploadError(
          "audio_file_too_large",
          t("audioTooBig", { size: MAX_UPLOAD_LABEL }),
          "product_limit"
        );
        setFilename(file.name);
        setPhase("error");
        setUploadError(error);
        trackEvent("transcribe_fail", {
          tool_slug: toolSlug,
          source,
          input_type: inputType,
          error_type: error.type,
          error_code: error.code,
          error_message: error.message,
        });
        return;
      }

      if (!signedIn) {
        markSignInPending();
        await signIn("google", { redirectTo: postSignInPath });
        return;
      }
      setUploadError(null);
      setFilename(file.name);
      setPhase("preparing");
      setProgress(0);
      let transcriptId: string | null = null;
      let keepTranscript = false;
      let step = "preparing";
      let uploadBytes = file.size;
      let uploadDurationSecEstimate: number | undefined;

      try {
        const isVideo = inputType === "video";
        const durationSec =
          durationSecOverride && durationSecOverride > 0
            ? durationSecOverride
            : await readMediaDuration(file, inputType);
        uploadDurationSecEstimate = durationSec || undefined;

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
        uploadBytes = uploadBody.size;
        uploadDurationSecEstimate = uploadDurationSec || undefined;

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
        if (!initRes.ok) throw await readError(initRes, t);
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
        if (!startRes.ok) throw await readError(startRes, t);

        step = "polling transcript";
        setPhase("polling");
        keepTranscript = true;
        const finalStatus = await pollStatus(transcriptId, t);
        if (finalStatus === "completed") {
          trackEvent("transcribe_success", {
            tool_slug: toolSlug,
            source,
            input_type: inputType,
            duration_sec: uploadDurationSec || undefined,
          });
          router.push(`/dashboard/transcripts/${transcriptId}`);
        } else {
          throw new Error(t("transcriptionGeneric", { status: finalStatus }));
        }
      } catch (err) {
        const uploadFailure = uploadErrorDetail(err, step, t);
        console.error("Upload failed", { step, transcriptId, error: serializeError(err) });
        trackEvent("transcribe_fail", {
          tool_slug: toolSlug,
          source,
          input_type: inputType,
          error_type: uploadFailure.type,
          error_code: uploadFailure.code,
          error_message: errorSummary(uploadFailure.message),
          ...uploadFailureDiagnostics({
            err,
            step,
            fileSizeBytes: uploadBytes,
            durationSec: uploadDurationSecEstimate,
            retryable: uploadFailure.retryable,
          }),
        });
        if (uploadFailure.code === "persist_failed") {
          keepTranscript = true;
        }
        if (transcriptId && !keepTranscript) {
          await cleanupTranscript(transcriptId);
        }
        setPhase("error");
        setUploadError(uploadFailure);
      }
    },
    [router, signedIn, postSignInPath, audioOnly, toolSlug, t]
  );

  const retry = useCallback(() => {
    const lastPick = lastPickRef.current;
    if (!lastPick) return;
    void onPick(lastPick.file, lastPick.source, lastPick.durationSecOverride);
  }, [onPick]);

  return {
    phase,
    progress,
    errorMsg: uploadError?.message ?? null,
    uploadError,
    filename,
    onPick,
    retry,
  };
}

/** Plain, dashboard-styled drag/drop uploader. */
export function Uploader(props: UseUploadOpts) {
  const t = useTranslations("Dashboard.uploader");
  const { phase, progress, uploadError, filename, onPick, retry } = useUpload(props);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const limitCopyKey =
    props.tier === "pro" ? "limitsPro" : props.tier === "basic" ? "limitsBasic" : "limitsFree";

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
          <p className="mt-1 text-sm text-ink/60">{t(limitCopyKey)}</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-6 rounded-full bg-ink px-5 py-2 text-[13px] font-medium text-paper hover:bg-accent"
          >
            {t("choose")}
          </button>
          <UploadErrorHelp
            error={uploadError}
            onRetry={retry}
            onChooseFile={() => inputRef.current?.click()}
            checkoutSuccessPath={props.checkoutSuccessPath ?? props.postSignInPath ?? "/dashboard/new"}
          />
        </>
      ) : (
        <ProgressView phase={phase} progress={progress} filename={filename} />
      )}
    </div>
  );
}

export function UploadErrorHelp({
  error,
  onRetry,
  onChooseFile,
  checkoutSuccessPath,
}: {
  error: UploadErrorDetail | null;
  onRetry?: () => void;
  onChooseFile?: () => void;
  checkoutSuccessPath?: string;
}) {
  const t = useTranslations("Dashboard.uploader");
  const [guideOpen, setGuideOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const showExtractGuide = error?.help === "extract_audio";
  const showQuotaUpgrade =
    checkoutSuccessPath !== undefined &&
    (error?.code === "no_quota" || error?.code === "insufficient_quota");

  useEffect(() => {
    if (showExtractGuide) setGuideOpen(true);
  }, [showExtractGuide, error?.code, error?.message]);

  useEffect(() => {
    if (showQuotaUpgrade) setUpgradeOpen(true);
  }, [showQuotaUpgrade, error?.code, error?.message]);

  if (!error) return null;

  if (!showExtractGuide) {
    return (
      <>
        <div className="mt-4 text-sm text-red-600">
          <p>{error.message}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {error.retryable && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full border border-line bg-paper px-4 py-2 text-[13px] font-medium text-ink transition hover:border-ink/40 hover:bg-card"
              >
                {t("retry")}
              </button>
            ) : null}
            {showQuotaUpgrade ? (
              <button
                type="button"
                onClick={() => setUpgradeOpen(true)}
                className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-accent"
              >
                {t("upgradePlan")}
              </button>
            ) : null}
          </div>
        </div>
        {showQuotaUpgrade ? (
          <UpgradePlanModal
            reason="quota"
            open={upgradeOpen}
            checkoutSuccessPath={checkoutSuccessPath}
            onClose={() => setUpgradeOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="inline-flex items-center justify-center rounded-full border border-line bg-paper px-4 py-2 text-[13px] font-medium text-ink transition hover:border-ink/40 hover:bg-card"
        >
          {t("extractGuideButton")}
        </button>
      </div>
      {guideOpen && typeof document !== "undefined" ? createPortal(
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-ink/65 px-4 py-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="extract-audio-guide-title"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-line bg-paper p-6 text-left shadow-[0_30px_80px_-35px_rgba(14,13,11,0.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-red-600">{error.message}</p>
                <h2 id="extract-audio-guide-title" className="mt-2 text-xl font-medium text-ink">
                  {t("extractGuideTitle")}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="shrink-0 rounded-full border border-line px-3 py-1 text-[13px] font-medium text-ink transition hover:border-ink/40"
              >
                {t("close")}
              </button>
            </div>
            <div className="mt-5 grid gap-3 text-sm leading-6 text-ink/75 sm:grid-cols-2">
              <section className="rounded-xl border border-line bg-card p-4">
                <p className="font-medium text-ink">{t("extractGuideMacTitle")}</p>
                <p className="mt-1">{t("extractGuideMac")}</p>
              </section>
              <section className="rounded-xl border border-line bg-card p-4">
                <p className="font-medium text-ink">{t("extractGuideWindowsTitle")}</p>
                <p className="mt-1">{t("extractGuideWindows")}</p>
              </section>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              {error.retryable && onRetry ? (
                <button
                  type="button"
                  onClick={() => {
                    setGuideOpen(false);
                    onRetry();
                  }}
                  className="rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink transition hover:border-ink/40"
                >
                  {t("retry")}
                </button>
              ) : null}
              {onChooseFile ? (
                <button
                  type="button"
                  onClick={() => {
                    setGuideOpen(false);
                    onChooseFile();
                  }}
                  className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-accent"
                >
                  {t("chooseAudioFile")}
                </button>
              ) : null}
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
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

const AUDIO_EXTENSIONS = new Set([
  "aac",
  "aif",
  "aiff",
  "flac",
  "m4a",
  "mp3",
  "oga",
  "ogg",
  "opus",
  "wav",
  "webm",
]);

const VIDEO_EXTENSIONS = new Set([
  "avi",
  "flv",
  "m4v",
  "mkv",
  "mov",
  "mp4",
  "mpeg",
  "mpg",
  "webm",
  "wmv",
]);

function isLikelyAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  if (file.type.startsWith("video/")) return false;

  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? AUDIO_EXTENSIONS.has(ext) : false;
}

function isLikelyVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  if (file.type.startsWith("audio/")) return false;

  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? VIDEO_EXTENSIONS.has(ext) : false;
}

function getUploadInputType(file: File): "audio" | "video" | "unknown" {
  if (isLikelyAudioFile(file)) return "audio";
  if (isLikelyVideoFile(file)) return "video";
  return "unknown";
}

async function readMediaDuration(
  file: File,
  inputType: "audio" | "video" | "unknown"
): Promise<number> {
  const url = URL.createObjectURL(file);
  const tag = inputType === "video" ? "video" : "audio";
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
  const startedAt = Date.now();
  const attempt = (n: number): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let lastTick = Date.now();
      let lastLoaded = 0;
      const stallTimer = setInterval(() => {
        if (Date.now() - lastTick > UPLOAD_STALL_MS) {
          clearInterval(stallTimer);
          xhr.abort();
          reject(
            new UploadTransportError(
              "upload_stalled",
              t("uploadNetworkError"),
              n,
              Date.now() - startedAt
            )
          );
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
        else {
          reject(
            new UploadTransportError(
              "upload_http_error",
              `Upload failed: ${xhr.status} ${xhr.responseText.slice(0, 200)}`,
              n,
              Date.now() - startedAt,
              xhr.status
            )
          );
        }
      });
      xhr.addEventListener("error", () => {
        done();
        reject(
          new UploadTransportError(
            "upload_network_error",
            t("uploadNetworkError"),
            n,
            Date.now() - startedAt
          )
        );
      });
      xhr.addEventListener("abort", () => done());
      xhr.send(file);
    }).catch((err) => {
      if (isRetryableTransportError(err) && n < UPLOAD_MAX_ATTEMPTS) {
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
    if (!res.ok) throw await readError(res, t);
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
  if (err instanceof Error && err.message === "extraction_timeout") return t("extractionTimeout");
  if (err instanceof Error && err.message) return err.message;
  if (err instanceof DOMException && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return t("uploadFallback", { step });
}

function isRetryableTransportError(err: unknown): boolean {
  if (!(err instanceof UploadTransportError)) return false;
  if (err.code === "upload_network_error" || err.code === "upload_stalled") return true;
  return err.status === 408 || err.status === 429 || (err.status !== undefined && err.status >= 500);
}

function uploadFailureDiagnostics({
  err,
  step,
  fileSizeBytes,
  durationSec,
  retryable,
}: {
  err: unknown;
  step: string;
  fileSizeBytes: number;
  durationSec?: number;
  retryable?: boolean;
}): {
  step: string;
  file_size_mb: number;
  duration_sec?: number;
  upload_attempts?: number;
  upload_elapsed_sec?: number;
  upload_status?: number;
  retryable?: boolean;
} {
  const diagnostics = {
    step,
    file_size_mb: Number((fileSizeBytes / (1024 * 1024)).toFixed(2)),
    duration_sec: durationSec ? Math.round(durationSec) : undefined,
    retryable,
  };

  if (!(err instanceof UploadTransportError)) return diagnostics;

  return {
    ...diagnostics,
    upload_attempts: err.attempts,
    upload_elapsed_sec: Number((err.elapsedMs / 1000).toFixed(1)),
    upload_status: err.status,
  };
}

function makeUploadError(
  code: string,
  message: string,
  type: UploadErrorType = "technical",
  opts: { help?: UploadHelp; retryable?: boolean } = {}
): UploadErrorDetail {
  return {
    code,
    message,
    type,
    help: opts.help,
    retryable: opts.retryable,
  };
}

function uploadErrorDetail(err: unknown, step: string, t: UploaderT): UploadErrorDetail {
  if (err instanceof UploadFlowError) {
    return makeUploadError(err.code, err.message, err.type, {
      help: err.help,
      retryable: err.retryable,
    });
  }

  if (err instanceof UploadTransportError) {
    return makeUploadError(err.code, err.message, "technical", {
      retryable: isRetryableTransportError(err),
    });
  }

  if (err instanceof Error && err.message === "cannot_read_metadata") {
    return makeUploadError("cannot_read_metadata", t("cannotReadMetadata"));
  }

  if (err instanceof Error && err.message === "extraction_timeout") {
    return makeUploadError("extraction_timeout", t("extractionTimeout"), "technical", {
      help: "extract_audio",
      retryable: true,
    });
  }

  if (err instanceof Error && err.message === "webaudio_timeout") {
    return makeUploadError("webaudio_timeout", t("extractionTimeout"), "technical", {
      help: "extract_audio",
      retryable: true,
    });
  }

  const message = uploadErrorMessage(err, step, t);
  return makeUploadError(uploadStepCode(step), message);
}

function uploadStepCode(step: string): string {
  switch (step) {
    case "preparing":
      return "prepare_failed";
    case "extracting audio":
      return "audio_extraction_failed";
    case "uploading audio":
      return "audio_upload_failed";
    case "submitting transcript":
      return "transcript_submit_failed";
    case "polling transcript":
      return "transcript_poll_failed";
    default:
      return "upload_failed";
  }
}

async function readError(res: Response, t: UploaderT): Promise<UploadFlowError> {
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
      case "unauthorized":
        return new UploadFlowError("unauthorized", t("requestFailed", { status: res.status }), "auth");
      case "file_too_large": {
        const mb = j.maxBytes ? Math.floor(j.maxBytes / (1024 * 1024)) : null;
        return new UploadFlowError("file_too_large", mb
          ? t("fileTooLargeWithCap", { mb })
          : t("fileTooLarge"), "product_limit");
      }
      case "duration_exceeds_tier": {
        const min = j.maxSec ? Math.floor(j.maxSec / 60) : null;
        return new UploadFlowError("duration_exceeds_tier", min
          ? t("durationExceedsTierWithCap", { min })
          : t("durationExceedsTier"), "product_limit");
      }
      case "no_quota":
        return new UploadFlowError("no_quota", j.capMin
          ? t("noQuotaWithCap", { capMin: j.capMin })
          : t("noQuota"), "quota");
      case "insufficient_quota":
        return new UploadFlowError("insufficient_quota", t("insufficientQuota", {
          neededMin: j.neededMin ?? "?",
          remainingMin: j.remainingMin ?? 0,
        }), "quota");
      case "aai_submit_failed":
        return new UploadFlowError("aai_submit_failed", t("aaiSubmitFailed"));
      case "persist_failed":
        return new UploadFlowError("persist_failed", t("persistFailed"));
      default:
        return new UploadFlowError(j.error ?? "request_failed", t("requestFailed", { status: res.status }));
    }
  } catch {
    return new UploadFlowError("request_failed", t("requestFailed", { status: res.status }));
  }
}
