"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { trackEvent, UPLOAD_PIPELINE_VERSION } from "@/lib/analytics";
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS } from "@/lib/media-upload";
import { PLANS, type Tier } from "@/lib/plans";
import type { UploadFallbackReason, UploadPipeline } from "@/lib/upload-preflight";
import { UpgradePlanModal } from "./UpgradePlanModal";
import { markSignInPending } from "./Track";

const DEFAULT_TOOL_SLUG = "transcribe";

type UploaderT = ReturnType<typeof useTranslations<"Dashboard.uploader">>;

const ACCEPT = "audio/*,video/*";
// Build-time kill switch: changing it requires rebuilding and redeploying the client bundle.
const DIRECT_VIDEO_ENABLED = process.env.NEXT_PUBLIC_DIRECT_VIDEO_UPLOAD_ENABLED !== "false";

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
type UpgradeReason = "quota" | "duration" | "file_size";

export type UploadErrorDetail = {
  message: string;
  code: string;
  type: UploadErrorType;
  help?: UploadHelp;
  retryable?: boolean;
  upgradeReason?: UpgradeReason;
  suggestedTier?: "pro";
  canUpgrade?: boolean;
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
    opts: {
      help?: UploadHelp;
      retryable?: boolean;
      upgradeReason?: UpgradeReason;
      suggestedTier?: "pro";
      canUpgrade?: boolean;
    } = {}
  ) {
    super(message);
    this.name = "UploadFlowError";
    this.code = code;
    this.type = type;
    this.help = opts.help;
    this.retryable = opts.retryable ?? false;
    this.upgradeReason = opts.upgradeReason;
    this.suggestedTier = opts.suggestedTier;
    this.canUpgrade = opts.canUpgrade;
  }

  upgradeReason?: UpgradeReason;
  suggestedTier?: "pro";
  canUpgrade?: boolean;
}

class UploadTransportError extends Error {
  constructor(
    public code:
      | "upload_network_error"
      | "upload_stalled"
      | "upload_http_error"
      | "upload_timeout",
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

type PendingProcessing = {
  transcriptId: string;
  filename: string;
  toolSlug: string;
  source: "upload" | "record";
  inputType: "audio" | "video" | "unknown";
  uploadMode: UploadPipeline;
  fallbackReason?: UploadFallbackReason;
  fileSizeMb: number;
  durationSec?: number;
  allowPartial?: boolean;
  partialRemainingMin?: number;
  partialConfirmedMin?: number;
  startedAt: number;
};

export type PartialTranscriptOffer = {
  file: File;
  source: "upload";
  inputType: "audio" | "video" | "unknown";
  durationSecOverride?: number;
  skipDurationRead: boolean;
  sourceDurationSec?: number;
  remainingMin: number;
  processingMin: number;
  fileSizeMb: number;
  toolSlug: string;
};

const PENDING_PROCESSING_KEY = "scribix:pending_processing";

export function useUpload({
  signedIn,
  tier = "free",
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
  const [partialOffer, setPartialOffer] = useState<PartialTranscriptOffer | null>(null);
  const [processingLimitNoticeMin, setProcessingLimitNoticeMin] = useState<number | null>(null);
  const lastPickRef = useRef<{
    file: File;
    source: "upload" | "record";
    durationSecOverride?: number;
    allowPartial?: boolean;
    skipDurationRead?: boolean;
    confirmedProcessingMin?: number;
  } | null>(null);
  const recoveryStartedRef = useRef(false);
  const retrySubmitRef = useRef<PendingProcessing | null>(null);
  const activeDirectUploadRef = useRef<{
    props: ReturnType<typeof directVideoAnalytics>;
    step: ReturnType<typeof directVideoFailureStep>;
  } | null>(null);

  useEffect(() => {
    const markAbandoned = () => {
      const active = activeDirectUploadRef.current;
      if (!active) return;
      trackEvent("direct_video_abandoned", {
        ...active.props,
        step: active.step,
      });
      activeDirectUploadRef.current = null;
    };
    window.addEventListener("pagehide", markAbandoned);
    return () => window.removeEventListener("pagehide", markAbandoned);
  }, []);

  useEffect(() => {
    const shouldWarn =
      phase === "extracting" ||
      phase === "uploading" ||
      phase === "submitting";
    if (!shouldWarn) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [phase]);

  const onPick = useCallback(
    async (
      file: File,
      source: "upload" | "record" = "upload",
      durationSecOverride?: number,
      allowPartial = false,
      skipDurationRead = false,
      confirmedProcessingMin?: number
    ) => {
      lastPickRef.current = {
        file,
        source,
        durationSecOverride,
        allowPartial,
        skipDurationRead,
        confirmedProcessingMin,
      };
      setPartialOffer(null);
      setProcessingLimitNoticeMin(null);
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
      let multipartUploadId: string | null = null;
      let directVideo = false;
      let directUploadCompleted = false;
      let fallbackReason: UploadFallbackReason | undefined;
      let directUploadStarted = false;
      let pendingProcessing: PendingProcessing | null = null;
      const uploadStartedAt = Date.now();

      try {
        const isVideo = inputType === "video";
        let durationSec = durationSecOverride && durationSecOverride > 0
          ? durationSecOverride
          : undefined;
        if (!durationSec && !skipDurationRead) {
          try {
            durationSec = await readMediaDuration(file, inputType);
          } catch (error) {
            if (source !== "upload" || (isVideo && !DIRECT_VIDEO_ENABLED)) throw error;
          }
        }
        uploadDurationSecEstimate = durationSec;

        step = "preflight";
        const preflightRes = await fetch("/api/transcripts/preflight", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            bytes: file.size,
            mime: browserMediaMime(file, inputType),
            durationSec,
            isVideo,
            source,
            allowPartial,
          }),
        });
        if (!preflightRes.ok) {
          const preflightError = await readError(preflightRes, t);
          if (isVideo && (file.size > PLANS[tier].maxFileBytes || !durationSec)) {
            trackEvent("direct_video_preflight_rejected", {
              ...directVideoAnalytics({
                fallbackReason: !durationSec ? "cannot_read_metadata" : "over_1gb",
                file,
                durationSec,
                startedAt: uploadStartedAt,
              }),
              error_code: preflightError.code,
            });
          }
          throw preflightError;
        }
        const preflight = (await preflightRes.json()) as {
          pipeline: UploadPipeline;
          fallbackReason?: UploadFallbackReason;
          remainingMin: number;
          processableMin: number;
          requiresPartialConfirmation?: boolean;
        };
        if (
          preflight.requiresPartialConfirmation &&
          source === "upload" &&
          !allowPartial
        ) {
          const offer: PartialTranscriptOffer = {
            file,
            source,
            inputType,
            durationSecOverride: durationSec,
            skipDurationRead: !durationSec,
            sourceDurationSec: durationSec,
            remainingMin: preflight.remainingMin,
            processingMin: preflight.processableMin,
            fileSizeMb: fileSizeMb(file.size),
            toolSlug,
          };
          trackEvent("partial_transcript_offer_shown", partialOfferAnalytics(offer));
          setPartialOffer(offer);
          setPhase("idle");
          return;
        }
        directVideo = preflight.pipeline === "direct_video";
        fallbackReason = preflight.fallbackReason;

        let uploadBody: Blob = file;
        let uploadFilename = file.name;
        let uploadMime = browserMediaMime(file, inputType);
        let uploadDurationSec = durationSec;

        if (isVideo) {
          if (!directVideo) {
            step = "extracting audio";
            setPhase("extracting");
            setProgress(0);
            try {
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
            } catch (error) {
              if (!DIRECT_VIDEO_ENABLED) throw error;
              directVideo = true;
              fallbackReason = extractionFallbackReason(error);
              uploadBody = file;
              uploadFilename = file.name;
              uploadMime = browserMediaMime(file, inputType);
              uploadDurationSec = durationSec;
            }
          }
        }
        uploadBytes = uploadBody.size;
        uploadDurationSecEstimate = uploadDurationSec || undefined;

        if (directVideo) {
          const directProps = directVideoAnalytics({
            fallbackReason,
            file,
            durationSec: uploadDurationSec,
            startedAt: uploadStartedAt,
          });
          trackEvent("direct_video_attempt", directProps);
          trackEvent("direct_video_selected", directProps);
          directUploadStarted = true;
          activeDirectUploadRef.current = {
            props: directProps,
            step: "multipart_init",
          };
          trackEvent("direct_video_upload_started", directProps);
        }

        step = directVideo ? "multipart init" : "single upload init";
        const initRes = await fetch("/api/transcripts/init", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: uploadFilename,
            bytes: uploadBody.size,
            mime: uploadMime,
            durationSec: uploadDurationSec,
            isVideo: directVideo,
            directVideo,
            source,
            allowPartial,
          }),
        });
        if (!initRes.ok) throw await readError(initRes, t);
        const init = (await initRes.json()) as {
          transcriptId: string;
          uploadUrl?: string;
          uploadId?: string;
          partSize?: number;
          uploadMode: "single" | "multipart";
        };
        transcriptId = init.transcriptId;

        step = directVideo ? "uploading video" : "uploading audio";
        setPhase("uploading");
        setProgress(0);
        if (directVideo) {
          if (!init.uploadId || !init.partSize) throw new Error("invalid_multipart_init");
          multipartUploadId = init.uploadId;
          if (activeDirectUploadRef.current) {
            activeDirectUploadRef.current.step = "part_upload";
          }
          await uploadMultipart(
            transcriptId,
            init.uploadId,
            init.partSize,
            file,
            setProgress,
            t,
            () => {
              step = "completing multipart";
              if (activeDirectUploadRef.current) {
                activeDirectUploadRef.current.step = "multipart_complete";
              }
            }
          );
          trackEvent("direct_video_upload_completed", directVideoAnalytics({
            fallbackReason,
            file,
            durationSec: uploadDurationSec,
            startedAt: uploadStartedAt,
          }));
          directUploadCompleted = true;
          activeDirectUploadRef.current = null;
        } else {
          if (!init.uploadUrl) throw new Error("invalid_single_upload_init");
          await uploadWithProgress(init.uploadUrl, uploadBody, setProgress, t, uploadMime);
        }

        step = "submitting transcript";
        setPhase("submitting");
        pendingProcessing = {
          transcriptId,
          filename: file.name,
          toolSlug,
          source,
          inputType,
          uploadMode: directVideo ? "direct_video" : "extracted_audio",
          fallbackReason,
          fileSizeMb: fileSizeMb(file.size),
          durationSec: uploadDurationSec || undefined,
          allowPartial,
          partialRemainingMin: allowPartial
            ? preflight.remainingMin
            : undefined,
          partialConfirmedMin: allowPartial
            ? confirmedProcessingMin ?? preflight.processableMin
            : undefined,
          startedAt: uploadStartedAt,
        };
        const startRes = await fetch(`/api/transcripts/${transcriptId}/start`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            durationSecEstimate: uploadDurationSec,
            allowPartial,
            confirmedPartialMin: allowPartial
              ? confirmedProcessingMin ?? preflight.processableMin
              : undefined,
          }),
        });
        const start = startRes.ok
          ? ((await startRes.json().catch(() => ({}))) as {
              processingLimitSec?: number;
            })
          : {};
        if (!startRes.ok) {
          const startError = await readError(startRes, t);
          if (startError.code !== "aai_submit_uncertain") throw startError;
          console.warn("AAI submit result is uncertain; continuing status recovery.", {
            transcriptId,
          });
        }
        if (allowPartial && startRes.ok) {
          const processingMin =
            typeof start.processingLimitSec === "number"
              ? Math.ceil(start.processingLimitSec / 60)
              : preflight.processableMin;
          const confirmedMin =
            confirmedProcessingMin ?? preflight.processableMin;
          if (processingMin !== confirmedMin) {
            setProcessingLimitNoticeMin(processingMin);
          }
          trackEvent("partial_transcription_started", {
            ...partialOfferAnalytics({
              file,
              source: "upload",
              inputType,
              durationSecOverride,
              skipDurationRead,
              sourceDurationSec: durationSec,
              remainingMin: preflight.remainingMin,
              processingMin,
              fileSizeMb: fileSizeMb(file.size),
              toolSlug,
            }),
            processing_minutes: processingMin,
          });
        }

        step = "polling transcript";
        setPhase("polling");
        keepTranscript = true;
        savePendingProcessing(pendingProcessing);
        if (directVideo) {
          trackEvent("direct_video_processing", directVideoAnalytics({
            fallbackReason,
            file,
            durationSec: uploadDurationSec,
            startedAt: uploadStartedAt,
          }));
        }
        const finalStatus = await pollStatus(transcriptId, t);
        if (finalStatus === "completed") {
          clearPendingProcessing(transcriptId);
          trackEvent("transcribe_success", {
            tool_slug: toolSlug,
            source,
            input_type: inputType,
            duration_sec: uploadDurationSec || undefined,
            upload_mode: directVideo ? "direct_video" : "extracted_audio",
            fallback_reason: fallbackReason,
            file_size_mb: fileSizeMb(file.size),
            upload_elapsed_sec: elapsedSec(uploadStartedAt),
            upload_pipeline_version: UPLOAD_PIPELINE_VERSION,
          });
          if (directVideo) {
            trackEvent("direct_video_transcribe_completed", directVideoAnalytics({
              fallbackReason,
              file,
              durationSec: uploadDurationSec,
              startedAt: uploadStartedAt,
            }));
          }
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
          upload_mode: directVideo ? "direct_video" : "extracted_audio",
          fallback_reason: fallbackReason,
          upload_pipeline_version: UPLOAD_PIPELINE_VERSION,
          ...uploadFailureDiagnostics({
            err,
            step,
            fileSizeBytes: uploadBytes,
            durationSec: uploadDurationSecEstimate,
            retryable: uploadFailure.retryable,
          }),
        });
        if (uploadFailure.code === "file_too_large") {
          trackEvent("upload_size_cap_rejected", {
            tool_slug: toolSlug,
            source,
            input_type: inputType,
            file_size_mb: fileSizeMb(file.size),
            error_code: uploadFailure.code,
            suggested_tier: uploadFailure.suggestedTier,
          });
        }
        if (directVideo && directUploadStarted && !directUploadCompleted) {
          trackEvent("direct_video_upload_failed", {
            ...directVideoAnalytics({
              fallbackReason,
              file,
              durationSec: uploadDurationSecEstimate,
              startedAt: uploadStartedAt,
            }),
            error_code: uploadFailure.code,
            step: directVideoFailureStep(step),
            retryable: uploadFailure.retryable,
          });
          activeDirectUploadRef.current = null;
        }
        if (
          uploadFailure.code === "persist_failed" ||
          uploadFailure.code === "aai_submit_uncertain" ||
          err instanceof MultipartCompletionUncertainError
        ) {
          keepTranscript = true;
        }
        if (uploadFailure.code === "aai_submit_failed" && pendingProcessing) {
          keepTranscript = true;
          retrySubmitRef.current = pendingProcessing;
        }
        if (transcriptId && multipartUploadId && !keepTranscript) {
          await abortMultipart(transcriptId, multipartUploadId);
        }
        if (transcriptId && !keepTranscript) {
          await cleanupTranscript(transcriptId);
        }
        setPhase("error");
        setUploadError(uploadFailure);
      }
    },
    [router, signedIn, postSignInPath, audioOnly, tier, toolSlug, t]
  );

  useEffect(() => {
    if (!signedIn || recoveryStartedRef.current) return;
    const pending = readPendingProcessing();
    if (!pending) return;
    recoveryStartedRef.current = true;
    setFilename(pending.filename);
    setUploadError(null);
    setPhase("polling");

    void pollStatus(pending.transcriptId, t)
      .then(() => {
        clearPendingProcessing(pending.transcriptId);
        trackEvent("transcribe_success", {
          tool_slug: pending.toolSlug,
          source: pending.source,
          input_type: pending.inputType,
          duration_sec: pending.durationSec,
          upload_mode: pending.uploadMode,
          fallback_reason: pending.fallbackReason,
          file_size_mb: pending.fileSizeMb,
          upload_elapsed_sec: elapsedSec(pending.startedAt),
          upload_pipeline_version: UPLOAD_PIPELINE_VERSION,
          restored: true,
        });
        if (pending.uploadMode === "direct_video") {
          trackEvent("direct_video_transcribe_completed", {
            upload_mode: "direct_video",
            fallback_reason: pending.fallbackReason,
            file_size_mb: pending.fileSizeMb,
            duration_sec: pending.durationSec,
            upload_elapsed_sec: elapsedSec(pending.startedAt),
            upload_pipeline_version: UPLOAD_PIPELINE_VERSION,
          });
        }
        router.push(`/dashboard/transcripts/${pending.transcriptId}`);
      })
      .catch((error) => {
        clearPendingProcessing(pending.transcriptId);
        const detail = uploadErrorDetail(error, "polling transcript", t);
        trackEvent("transcribe_fail", {
          tool_slug: pending.toolSlug,
          source: pending.source,
          input_type: pending.inputType,
          error_type: detail.type,
          error_code: detail.code,
          error_message: errorSummary(detail.message),
          step: "polling transcript",
          upload_mode: pending.uploadMode,
          fallback_reason: pending.fallbackReason,
          upload_pipeline_version: UPLOAD_PIPELINE_VERSION,
          restored: true,
        });
        setPhase("error");
        setUploadError(detail);
      });
  }, [router, signedIn, t]);

  const retry = useCallback(() => {
    const submit = retrySubmitRef.current;
    if (submit) {
      retrySubmitRef.current = null;
      setUploadError(null);
      setPhase("submitting");
      void fetch(`/api/transcripts/${submit.transcriptId}/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          durationSecEstimate: submit.durationSec,
          allowPartial: submit.allowPartial === true,
          confirmedPartialMin: submit.allowPartial
            ? submit.partialConfirmedMin
            : undefined,
        }),
      })
        .then(async (response) => {
          if (!response.ok) throw await readError(response, t);
          const start = (await response.json().catch(() => ({}))) as {
            processingLimitSec?: number;
          };
          if (submit.allowPartial) {
            const processingMin =
              typeof start.processingLimitSec === "number"
                ? Math.ceil(start.processingLimitSec / 60)
                : submit.partialConfirmedMin;
            if (processingMin !== undefined) {
              if (
                submit.partialConfirmedMin !== undefined &&
                processingMin !== submit.partialConfirmedMin
              ) {
                setProcessingLimitNoticeMin(processingMin);
              }
              trackEvent("partial_transcription_started", {
                tool_slug: submit.toolSlug,
                source: "upload",
                input_type: submit.inputType,
                source_duration_sec: submit.durationSec
                  ? Math.round(submit.durationSec)
                  : undefined,
                remaining_min:
                  submit.partialRemainingMin ??
                  submit.partialConfirmedMin ??
                  processingMin,
                processing_minutes: processingMin,
                file_size_mb: submit.fileSizeMb,
                duration_unknown: !submit.durationSec,
              });
            }
          }
          savePendingProcessing(submit);
          setPhase("polling");
          await pollStatus(submit.transcriptId, t);
          clearPendingProcessing(submit.transcriptId);
          trackEvent("transcribe_success", {
            tool_slug: submit.toolSlug,
            source: submit.source,
            input_type: submit.inputType,
            duration_sec: submit.durationSec,
            upload_mode: submit.uploadMode,
            fallback_reason: submit.fallbackReason,
            file_size_mb: submit.fileSizeMb,
            upload_elapsed_sec: elapsedSec(submit.startedAt),
            upload_pipeline_version: UPLOAD_PIPELINE_VERSION,
          });
          router.push(`/dashboard/transcripts/${submit.transcriptId}`);
        })
        .catch((error) => {
          const detail = uploadErrorDetail(error, "submitting transcript", t);
          if (detail.code === "aai_submit_failed") retrySubmitRef.current = submit;
          setPhase("error");
          setUploadError(detail);
        });
      return;
    }
    const lastPick = lastPickRef.current;
    if (!lastPick) return;
    void onPick(
      lastPick.file,
      lastPick.source,
      lastPick.durationSecOverride,
      lastPick.allowPartial,
      lastPick.skipDurationRead,
      lastPick.confirmedProcessingMin
    );
  }, [onPick, router, t]);

  const confirmPartial = useCallback(() => {
    if (!partialOffer) return;
    trackEvent("partial_transcript_confirmed", partialOfferAnalytics(partialOffer));
    void onPick(
      partialOffer.file,
      partialOffer.source,
      partialOffer.durationSecOverride,
      true,
      partialOffer.skipDurationRead,
      partialOffer.processingMin
    );
  }, [onPick, partialOffer]);

  const cancelPartial = useCallback(() => {
    setPartialOffer(null);
    setPhase("idle");
  }, []);

  const trackPartialUpgrade = useCallback(() => {
    if (!partialOffer) return;
    trackEvent(
      "partial_transcript_upgrade_clicked",
      partialOfferAnalytics(partialOffer)
    );
  }, [partialOffer]);

  return {
    phase,
    progress,
    errorMsg: uploadError?.message ?? null,
    uploadError,
    filename,
    onPick,
    retry,
    processingLimitNoticeMin,
    partialOffer,
    confirmPartial,
    cancelPartial,
    trackPartialUpgrade,
  };
}

/** Plain, dashboard-styled drag/drop uploader. */
export function Uploader(props: UseUploadOpts) {
  const t = useTranslations("Dashboard.uploader");
  const {
    phase,
    progress,
    uploadError,
    filename,
    onPick,
    retry,
    processingLimitNoticeMin,
    partialOffer,
    confirmPartial,
    cancelPartial,
    trackPartialUpgrade,
  } = useUpload(props);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const limitCopyKey =
    props.tier === "pro" ? "limitsPro" : props.tier === "basic" ? "limitsBasic" : "limitsFree";
  const videoLimitLabel = (props.tier === "basic" || props.tier === "pro") ? "5 GB" : "2 GB";

  return (
    <>
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
          e.currentTarget.value = "";
          if (f) onPick(f);
        }}
      />

      {phase === "idle" || phase === "error" ? (
        <>
          <p className="text-base font-medium">{t("dropPrompt")}</p>
          <p className="mt-1 text-sm text-ink/60">{t(limitCopyKey, { size: videoLimitLabel })}</p>
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
        <ProgressView
          phase={phase}
          progress={progress}
          filename={filename}
          processingLimitNoticeMin={processingLimitNoticeMin}
        />
      )}
      </div>
      <PartialTranscriptModal
        offer={partialOffer}
        checkoutSuccessPath={
          props.checkoutSuccessPath ?? props.postSignInPath ?? "/dashboard/new"
        }
        onConfirm={confirmPartial}
        onCancel={cancelPartial}
        onUpgrade={trackPartialUpgrade}
      />
    </>
  );
}

export function PartialTranscriptModal({
  offer,
  checkoutSuccessPath,
  onConfirm,
  onCancel,
  onUpgrade,
}: {
  offer: PartialTranscriptOffer | null;
  checkoutSuccessPath: string;
  onConfirm: () => void;
  onCancel: () => void;
  onUpgrade: () => void;
}) {
  const t = useTranslations("Dashboard.uploader");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  useEffect(() => {
    setUpgradeOpen(false);
  }, [offer?.file]);
  if (!offer || typeof document === "undefined") return null;

  const sourceMinutes = offer.sourceDurationSec
    ? Math.ceil(offer.sourceDurationSec / 60)
    : null;
  const dialog = upgradeOpen ? (
    <UpgradePlanModal
      reason="quota"
      open
      checkoutSuccessPath={checkoutSuccessPath}
      onCheckoutStart={() => {
        sessionStorage.setItem("scribix:upgrade_context", JSON.stringify({
          reason: "quota",
          error_code: "partial_transcript_upgrade",
          suggested_tier: "pro",
          tool_slug: offer.toolSlug,
        }));
      }}
      onClose={() => setUpgradeOpen(false)}
    />
  ) : (
    <div
      className="surface-modal-backdrop fixed inset-0 z-[100] grid place-items-center bg-ink/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partial-transcript-title"
    >
      <div className="surface-modal w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_30px_80px_-35px_rgba(14,13,11,0.5)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
          <div>
            <div className="mb-3 inline-grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
              <Clock3 size={19} strokeWidth={1.8} />
            </div>
            <h2
              id="partial-transcript-title"
              className="font-display text-[25px] font-medium tracking-tight text-ink"
            >
              {t("partialTitle")}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-ink/62">
              {sourceMinutes === null
                ? t("partialUnknownBody", {
                    processingMin: offer.processingMin,
                  })
                : t("partialKnownBody", {
                    totalMin: sourceMinutes,
                    processingMin: offer.processingMin,
                  })}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("partialClose")}
            className="inline-grid size-9 shrink-0 place-items-center rounded-lg text-ink/50 transition hover:bg-ink/5 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <div className="rounded-xl border border-line bg-card px-4 py-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {t("partialFileLength")}
            </p>
            <p className="mt-1.5 text-[18px] font-semibold text-ink">
              {sourceMinutes === null
                ? t("partialLengthUnavailable")
                : t("partialMinutes", { minutes: sourceMinutes })}
            </p>
          </div>
          <div className="rounded-xl border border-accent/25 bg-accent-soft/45 px-4 py-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              {t("partialAvailable")}
            </p>
            <p className="mt-1.5 text-[18px] font-semibold text-ink">
              {t("partialMinutes", { minutes: offer.processingMin })}
            </p>
          </div>
        </div>

        <div className="grid gap-2.5 border-t border-line px-5 py-5 sm:grid-cols-2 sm:px-6">
          <button
            type="button"
            onClick={() => {
              onUpgrade();
              setUpgradeOpen(true);
            }}
            className="rounded-xl border border-line bg-paper px-4 py-3 text-[13px] font-semibold text-ink transition hover:border-ink/35 hover:bg-card"
          >
            {t("partialUpgrade")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-accent px-4 py-3 text-[13px] font-semibold text-paper transition hover:bg-accent/90"
          >
            {t("partialConfirm", { minutes: offer.processingMin })}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
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
  const showUpgrade =
    checkoutSuccessPath !== undefined &&
    error?.canUpgrade === true &&
    error.upgradeReason !== undefined;

  useEffect(() => {
    if (showExtractGuide) setGuideOpen(true);
  }, [showExtractGuide, error?.code, error?.message]);

  useEffect(() => {
    if (!showUpgrade || !error?.upgradeReason) return;
    trackEvent("upgrade_cta_shown", {
      reason: error.upgradeReason,
      error_code: error.code,
      suggested_tier: error.suggestedTier,
    });
  }, [showUpgrade, error?.code, error?.suggestedTier, error?.upgradeReason]);

  const openUpgrade = () => {
    if (!error?.upgradeReason) return;
    trackEvent("upgrade_cta_click", {
      reason: error.upgradeReason,
      error_code: error.code,
      suggested_tier: error.suggestedTier,
    });
    trackEvent("upgrade_modal_opened", {
      reason: error.upgradeReason,
      error_code: error.code,
      suggested_tier: error.suggestedTier,
    });
    setUpgradeOpen(true);
  };

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
            {showUpgrade ? (
              <button
                type="button"
                onClick={openUpgrade}
                className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-accent"
              >
                {t("upgradePlan")}
              </button>
            ) : null}
          </div>
        </div>
        {showUpgrade && error.upgradeReason ? (
          <UpgradePlanModal
            reason={error.upgradeReason}
            open={upgradeOpen}
            checkoutSuccessPath={checkoutSuccessPath}
            onCheckoutStart={() => {
              sessionStorage.setItem("scribix:upgrade_context", JSON.stringify({
                reason: error.upgradeReason,
                error_code: error.code,
                suggested_tier: "pro",
              }));
            }}
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
        {showUpgrade ? (
          <button
            type="button"
            onClick={openUpgrade}
            className="ml-2 inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-accent"
          >
            {t("upgradePlan")}
          </button>
        ) : null}
      </div>
      {guideOpen && typeof document !== "undefined" ? createPortal(
        <div
          className="surface-modal-backdrop fixed inset-0 z-[100] grid place-items-center bg-ink/65 px-4 py-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="extract-audio-guide-title"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="surface-modal w-full max-w-xl rounded-2xl border border-line bg-paper p-6 text-left shadow-[0_30px_80px_-35px_rgba(14,13,11,0.45)]"
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
      {showUpgrade && error.upgradeReason ? (
        <UpgradePlanModal
          reason={error.upgradeReason}
          open={upgradeOpen}
          checkoutSuccessPath={checkoutSuccessPath}
          onCheckoutStart={() => {
            sessionStorage.setItem("scribix:upgrade_context", JSON.stringify({
              reason: error.upgradeReason,
              error_code: error.code,
              suggested_tier: "pro",
            }));
          }}
          onClose={() => setUpgradeOpen(false)}
        />
      ) : null}
    </>
  );
}

export function ProgressView({
  phase,
  progress,
  filename,
  processingLimitNoticeMin,
}: {
  phase: UploadPhase;
  progress: number;
  filename: string | null;
  processingLimitNoticeMin?: number | null;
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
      {processingLimitNoticeMin !== null &&
      processingLimitNoticeMin !== undefined ? (
        <p className="text-xs leading-5 text-accent">
          {t("partialLimitChanged", {
            minutes: processingLimitNoticeMin,
          })}
        </p>
      ) : null}
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

function isLikelyAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  if (file.type.startsWith("video/")) return false;

  const ext = file.name.split(".").pop()?.toLowerCase();
  // Some containers (for example MP4/WebM/FLV) can carry either audio or
  // video. With no browser MIME, prefer the video path; AAI can still extract
  // its audio, while treating a large video as audio would apply the 1 GB cap.
  return ext ? AUDIO_EXTENSIONS.has(ext) && !VIDEO_EXTENSIONS.has(ext) : false;
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

function browserMediaMime(file: File, inputType: "audio" | "video" | "unknown"): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() || "octet-stream";
  if (inputType === "video") return `video/${ext}`;
  if (inputType === "audio") return `audio/${ext}`;
  return "application/octet-stream";
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
      const onLoaded = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
      const onError = () => {
        window.clearTimeout(timeoutId);
        reject(new Error("cannot_read_metadata"));
      };
      const timeoutId = window.setTimeout(onError, 10_000);
      el.addEventListener("loadedmetadata", onLoaded, { once: true });
      el.addEventListener("error", onError, { once: true });
    });
    if (Number.isFinite(el.duration) && el.duration > 0) return el.duration;
    throw new Error("cannot_read_metadata");
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
  t: UploaderT,
  mime?: string
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
      if (mime) xhr.setRequestHeader("content-type", mime);
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
        return waitUntilOnline().then(() => attempt(n + 1));
      }
      throw err;
    });

  return attempt(1);
}

async function uploadMultipart(
  transcriptId: string,
  uploadId: string,
  partSize: number,
  file: File,
  onProgress: (frac: number) => void,
  t: UploaderT,
  onCompleteStarted?: () => void
): Promise<void> {
  const overallStartedAt = Date.now();
  const overallTimeoutMs = 4 * 60 * 60 * 1000;
  const partCount = Math.ceil(file.size / partSize);
  const loadedByPart = new Array<number>(partCount).fill(0);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= partCount) return;
      if (Date.now() - overallStartedAt > overallTimeoutMs) {
        throw new UploadTransportError(
          "upload_timeout",
          t("uploadNetworkError"),
          1,
          Date.now() - overallStartedAt
        );
      }
      const partNumber = index + 1;
      const start = index * partSize;
      const end = Math.min(start + partSize, file.size);
      const blob = file.slice(start, end);

      const signResponse = await fetch(`/api/transcripts/${transcriptId}/multipart/part`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId, partNumber }),
      });
      if (!signResponse.ok) throw await readError(signResponse, t);
      const { url } = (await signResponse.json()) as { url?: string };
      if (!url) throw new Error("invalid_multipart_part_url");

      await uploadWithProgress(url, blob, (fraction) => {
        loadedByPart[index] = Math.max(loadedByPart[index], fraction * blob.size);
        const loaded = loadedByPart.reduce((total, bytes) => total + bytes, 0);
        onProgress(Math.min(1, loaded / file.size));
      }, t);
      loadedByPart[index] = blob.size;
    }
  };

  await Promise.all([worker(), worker()]);
  onCompleteStarted?.();
  await completeMultipartWithRetry(transcriptId, uploadId, t);
  onProgress(1);
}

class MultipartCompletionUncertainError extends Error {
  constructor(public cause: unknown) {
    super("multipart_completion_uncertain");
    this.name = "MultipartCompletionUncertainError";
  }
}

async function completeMultipartWithRetry(
  transcriptId: string,
  uploadId: string,
  t: UploaderT
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`/api/transcripts/${transcriptId}/multipart/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });
      if (response.ok) return;
      const error = await readError(response, t);
      if (response.status < 500 && response.status !== 408 && response.status !== 429) throw error;
      lastError = error;
    } catch (error) {
      if (error instanceof UploadFlowError) throw error;
      lastError = error;
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw new MultipartCompletionUncertainError(lastError);
}

async function abortMultipart(transcriptId: string, uploadId: string): Promise<void> {
  try {
    await fetch(`/api/transcripts/${transcriptId}/multipart/abort`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uploadId }),
    });
  } catch {
    // The bucket lifecycle aborts abandoned multipart uploads after seven days.
  }
}

function extractionFallbackReason(error: unknown): UploadFallbackReason {
  const message = error instanceof Error ? error.message : "";
  return message === "extraction_timeout" || message === "webaudio_timeout"
    ? "extraction_timeout"
    : "extraction_failed";
}

function fileSizeMb(bytes: number): number {
  return Number((bytes / (1024 * 1024)).toFixed(2));
}

function elapsedSec(startedAt: number): number {
  return Number(((Date.now() - startedAt) / 1000).toFixed(1));
}

function partialOfferAnalytics(offer: PartialTranscriptOffer) {
  return {
    tool_slug: offer.toolSlug,
    source: offer.source,
    input_type: offer.inputType,
    source_duration_sec: offer.sourceDurationSec
      ? Math.round(offer.sourceDurationSec)
      : undefined,
    remaining_min: offer.remainingMin,
    processing_minutes: offer.processingMin,
    file_size_mb: offer.fileSizeMb,
    duration_unknown: !offer.sourceDurationSec,
  };
}

function directVideoAnalytics({
  fallbackReason,
  file,
  durationSec,
  startedAt,
}: {
  fallbackReason?: UploadFallbackReason;
  file: File;
  durationSec?: number;
  startedAt: number;
}) {
  return {
    upload_mode: "direct_video" as const,
    fallback_reason: fallbackReason,
    file_size_mb: fileSizeMb(file.size),
    duration_sec: durationSec ? Math.round(durationSec) : undefined,
    upload_elapsed_sec: elapsedSec(startedAt),
    upload_pipeline_version: UPLOAD_PIPELINE_VERSION,
  };
}

async function pollStatus(id: string, t: UploaderT): Promise<"completed"> {
  let delayMs = 3_000;
  while (true) {
    await wait(delayMs);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await waitUntilOnline();
    }
    try {
      const res = await fetch(`/api/transcripts/${id}/status`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 408 || res.status === 429 || res.status >= 500) {
          delayMs = Math.min(15_000, Math.round(delayMs * 1.6));
          continue;
        }
        throw await readError(res, t);
      }
      const { status, error } = (await res.json()) as { status: string; error: string | null };
      delayMs = 3_000;
      if (status === "completed") return "completed";
      if (status === "error") {
        throw new UploadFlowError(
          error || "transcription_failed",
          error ? t("transcriptionGeneric", { status: error }) : t("transcriptionFailed"),
          "technical"
        );
      }
    } catch (error) {
      if (error instanceof UploadFlowError) throw error;
      delayMs = Math.min(15_000, Math.round(delayMs * 1.6));
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitUntilOnline(): Promise<void> {
  if (typeof window === "undefined" || navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener("online", () => resolve(), { once: true });
  });
}

function savePendingProcessing(pending: PendingProcessing): void {
  try {
    sessionStorage.setItem(PENDING_PROCESSING_KEY, JSON.stringify(pending));
  } catch {}
}

function readPendingProcessing(): PendingProcessing | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PROCESSING_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingProcessing>;
    if (
      typeof value.transcriptId !== "string" ||
      typeof value.filename !== "string" ||
      typeof value.toolSlug !== "string" ||
      typeof value.startedAt !== "number" ||
      (value.uploadMode !== "direct_video" && value.uploadMode !== "extracted_audio")
    ) {
      sessionStorage.removeItem(PENDING_PROCESSING_KEY);
      return null;
    }
    return value as PendingProcessing;
  } catch {
    return null;
  }
}

function clearPendingProcessing(transcriptId: string): void {
  const pending = readPendingProcessing();
  if (!pending || pending.transcriptId === transcriptId) {
    try {
      sessionStorage.removeItem(PENDING_PROCESSING_KEY);
    } catch {}
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
  opts: {
    help?: UploadHelp;
    retryable?: boolean;
    upgradeReason?: UpgradeReason;
    suggestedTier?: "pro";
    canUpgrade?: boolean;
  } = {}
): UploadErrorDetail {
  return {
    code,
    message,
    type,
    help: opts.help,
    retryable: opts.retryable,
    upgradeReason: opts.upgradeReason,
    suggestedTier: opts.suggestedTier,
    canUpgrade: opts.canUpgrade,
  };
}

function uploadErrorDetail(err: unknown, step: string, t: UploaderT): UploadErrorDetail {
  if (err instanceof UploadFlowError) {
    return makeUploadError(err.code, err.message, err.type, {
      help: err.help,
      retryable: err.retryable,
      upgradeReason: err.upgradeReason,
      suggestedTier: err.suggestedTier,
      canUpgrade: err.canUpgrade,
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
    case "uploading video":
      return "direct_video_upload_failed";
    case "submitting transcript":
      return "transcript_submit_failed";
    case "polling transcript":
      return "transcript_poll_failed";
    default:
      return "upload_failed";
  }
}

function directVideoFailureStep(step: string) {
  if (step === "multipart init") return "multipart_init" as const;
  if (step === "uploading video") return "part_upload" as const;
  if (step === "completing multipart") return "multipart_complete" as const;
  if (step === "submitting transcript") return "aai_submit" as const;
  if (step === "polling transcript") return "polling" as const;
  return "part_upload" as const;
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
      canUpgrade?: boolean;
      suggestedTier?: "pro";
      help?: UploadHelp;
    };
    switch (j.error) {
      case "unauthorized":
        return new UploadFlowError("unauthorized", t("requestFailed", { status: res.status }), "auth");
      case "file_too_large": {
        const mb = j.maxBytes ? Math.floor(j.maxBytes / (1024 * 1024)) : null;
        return new UploadFlowError("file_too_large", mb
          ? t("fileTooLargeWithCap", { mb })
          : t("fileTooLarge"), "product_limit", {
          help: j.help,
          upgradeReason: "file_size",
          canUpgrade: j.canUpgrade,
          suggestedTier: j.suggestedTier,
        });
      }
      case "duration_exceeds_tier": {
        const min = j.maxSec ? Math.floor(j.maxSec / 60) : null;
        return new UploadFlowError("duration_exceeds_tier", min
          ? t("durationExceedsTierWithCap", { min })
          : t("durationExceedsTier"), "product_limit", {
          help: j.help,
          upgradeReason: "duration",
          canUpgrade: j.canUpgrade,
          suggestedTier: j.suggestedTier,
        });
      }
      case "no_quota":
        return new UploadFlowError("no_quota", j.capMin
          ? t("noQuotaWithCap", { capMin: j.capMin })
          : t("noQuota"), "quota", {
          upgradeReason: "quota",
          canUpgrade: j.canUpgrade,
          suggestedTier: j.suggestedTier,
        });
      case "insufficient_quota":
        return new UploadFlowError("insufficient_quota", t("insufficientQuota", {
          neededMin: j.neededMin ?? "?",
          remainingMin: j.remainingMin ?? 0,
        }), "quota", {
          upgradeReason: "quota",
          canUpgrade: j.canUpgrade,
          suggestedTier: j.suggestedTier,
        });
      case "aai_submit_failed":
        return new UploadFlowError("aai_submit_failed", t("aaiSubmitFailed"), "technical", {
          retryable: true,
        });
      case "aai_submit_uncertain":
        return new UploadFlowError("aai_submit_uncertain", t("persistFailed"));
      case "unsupported_media":
        return new UploadFlowError("unsupported_media", t("unsupportedMedia"), "product_limit");
      case "persist_failed":
        return new UploadFlowError("persist_failed", t("persistFailed"));
      default:
        return new UploadFlowError(j.error ?? "request_failed", t("requestFailed", { status: res.status }));
    }
  } catch {
    return new UploadFlowError("request_failed", t("requestFailed", { status: res.status }));
  }
}
