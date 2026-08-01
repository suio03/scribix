import type { Tier } from "@/lib/plans";

export type AskAiQuestionSource = "starter" | "typed";
export type AskAiTranscriptSource = "upload" | "recording" | "youtube";

export type PlausibleEvents = {
  tool_visit: { tool_slug: string };
  landing_cta_impression: { tool_slug: string };
  landing_cta_click: { tool_slug: string; signed_in: boolean };
  pricing_billing_cycle_view: PricingBillingCycleEventProps;
  pricing_billing_cycle_change: PricingBillingCycleEventProps;
  transcribe_success: {
    tool_slug: string;
    source?: "upload" | "record";
    input_type?: "audio" | "video" | "unknown";
    duration_sec?: number;
    upload_mode?: "extracted_audio" | "direct_video";
    fallback_reason?: "over_1gb" | "cannot_read_metadata" | "extraction_timeout" | "extraction_failed";
    file_size_mb?: number;
    upload_elapsed_sec?: number;
    upload_pipeline_version?: string;
    restored?: boolean;
  };
  direct_video_attempt: DirectVideoEventProps;
  direct_video_selected: DirectVideoEventProps;
  direct_video_preflight_rejected: DirectVideoEventProps & {
    error_code: string;
  };
  direct_video_upload_started: DirectVideoEventProps;
  direct_video_upload_completed: DirectVideoEventProps;
  direct_video_upload_failed: DirectVideoEventProps & {
    error_code: string;
    step: UploadFailureStep;
    retryable?: boolean;
  };
  direct_video_processing: DirectVideoEventProps;
  direct_video_transcribe_completed: DirectVideoEventProps;
  direct_video_abandoned: DirectVideoEventProps & { step: UploadFailureStep };
  partial_transcript_offer_shown: PartialTranscriptEventProps;
  partial_transcript_confirmed: PartialTranscriptEventProps;
  partial_transcription_started: PartialTranscriptEventProps;
  partial_transcript_upgrade_clicked: PartialTranscriptEventProps;
  upload_size_cap_rejected: {
    tool_slug: string;
    source?: "upload" | "record";
    input_type?: "audio" | "video" | "unknown";
    file_size_mb: number;
    error_code: string;
    suggested_tier?: "pro";
  };
  transcribe_fail: {
    tool_slug: string;
    source?: "upload" | "record";
    input_type?: "audio" | "video" | "unknown";
    error_type?: "technical" | "product_limit" | "quota" | "auth";
    error_code: string;
    error_message?: string;
    step?: string;
    file_size_mb?: number;
    duration_sec?: number;
    upload_attempts?: number;
    upload_elapsed_sec?: number;
    upload_status?: number;
    retryable?: boolean;
    upload_mode?: "extracted_audio" | "direct_video";
    fallback_reason?: UploadFallbackReason;
    upload_pipeline_version?: string;
    restored?: boolean;
  };
  upgrade_cta_shown: UpgradeEventProps;
  upgrade_cta_click: UpgradeEventProps;
  upgrade_modal_opened: UpgradeEventProps;
  upgrade_checkout_completed: UpgradeEventProps & {
    tier: "basic" | "pro";
    cycle: "monthly" | "yearly";
    transaction_id?: string;
  };
  youtube_inspect_attempt: { step: "inspect"; tool_slug: string };
  youtube_inspect_fail: {
    step: "inspect";
    tool_slug: string;
    service: "scribix_app" | "youtube_caption_service";
    error_type: "technical" | "product_limit" | "quota" | "auth" | "user_input";
    error_code: string;
  };
  youtube_import_attempt: { step: "import"; tool_slug: string };
  youtube_import_fail: {
    step: "import";
    tool_slug: string;
    service: "scribix_app" | "youtube_caption_service";
    error_type: "technical" | "product_limit" | "quota" | "auth" | "user_input";
    error_code: string;
  };
  ask_ai_question_submitted: AskAiQuestionEventProps;
  ask_ai_answer_succeeded: AskAiQuestionEventProps & {
    answer_truncated: boolean;
    transcript_truncated: boolean;
    history_truncated: boolean;
  };
  ask_ai_answer_failed: AskAiQuestionEventProps & {
    error_code: string;
  };
  ask_ai_quota_reached: AskAiQuestionEventProps;
  ask_ai_upgrade_clicked: AskAiContextEventProps;
  ask_ai_chat_cleared: AskAiContextEventProps;
  signin_success: { method?: string };
  download_click: { format: string };
  checkout_click: {
    tier: "basic" | "pro";
    cycle: "monthly" | "yearly";
    signed_in: boolean;
  };
  checkout_created: {
    tier: "basic" | "pro";
    cycle: "monthly" | "yearly";
    transaction_id?: string;
  };
  checkout_opened: {
    tier: "basic" | "pro";
    cycle: "monthly" | "yearly";
    transaction_id?: string;
  };
  paddle_load_fail: {
    tier?: "basic" | "pro";
    cycle?: "monthly" | "yearly";
    transaction_id?: string;
    error_code:
      | "paddle_config_load_failed"
      | "paddle_config_missing"
      | "paddle_initialization_failed"
      | "paddle_not_initialized"
      | "paddle_overlay_open_failed";
    error_message?: string;
  };
  checkout_completed: {
    tier?: "basic" | "pro";
    cycle?: "monthly" | "yearly";
    transaction_id?: string;
    checkout_id?: string;
  };
  checkout_closed: {
    tier?: "basic" | "pro";
    cycle?: "monthly" | "yearly";
    transaction_id?: string;
    checkout_id?: string;
  };
  checkout_fail: {
    tier?: "basic" | "pro";
    cycle?: "monthly" | "yearly";
    transaction_id?: string;
    stage:
      | "create_checkout"
      | "paddle_ready"
      | "open_overlay"
      | "checkout";
    error_code: string;
    error_message?: string;
    paddle_status?: number;
  };
};

type AskAiContextEventProps = {
  plan_tier: Tier;
  transcript_source: AskAiTranscriptSource;
};

type AskAiQuestionEventProps = AskAiContextEventProps & {
  question_source: AskAiQuestionSource;
};

type DirectVideoEventProps = {
  upload_mode: "direct_video";
  fallback_reason?: UploadFallbackReason;
  file_size_mb: number;
  duration_sec?: number;
  upload_elapsed_sec: number;
  upload_pipeline_version: string;
};

type PartialTranscriptEventProps = {
  tool_slug: string;
  source: "upload";
  input_type: "audio" | "video" | "unknown";
  source_duration_sec?: number;
  remaining_min: number;
  processing_minutes: number;
  file_size_mb: number;
  duration_unknown: boolean;
};

type UploadFallbackReason =
  | "over_1gb"
  | "cannot_read_metadata"
  | "extraction_timeout"
  | "extraction_failed";

type UploadFailureStep =
  | "preflight"
  | "multipart_init"
  | "part_upload"
  | "multipart_complete"
  | "aai_submit"
  | "polling";

type UpgradeEventProps = {
  reason: "quota" | "duration" | "file_size";
  error_code: string;
  suggested_tier?: "basic" | "pro";
  tool_slug?: string;
  source?: "upload" | "record";
  input_type?: "audio" | "video" | "unknown";
};

type PricingBillingCycleEventProps = {
  cycle: "monthly" | "yearly";
  source: "pricing" | "billing";
  signed_in: boolean;
  current_tier: "free" | "basic" | "pro";
};

export const UPLOAD_PIPELINE_VERSION = "2026-07-25.1";

declare global {
  interface Window {
    plausible?: <K extends keyof PlausibleEvents>(
      eventName: K,
      options?: {
        props: PlausibleEvents[K];
      }
    ) => void;
    clarity?: (
      command: "event" | "set",
      key: string,
      value?: string | number | boolean | null
    ) => void;
  }
}

function sendToClarity<K extends keyof PlausibleEvents>(
  eventName: K,
  props?: PlausibleEvents[K]
) {
  if (typeof window === "undefined" || !window.clarity) return;

  const clarity = window.clarity;

  clarity("event", eventName);

  if (!props) return;

  Object.entries(props).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    const clarityValue =
      typeof value === "object"
        ? JSON.stringify(value)
        : (value as string | number | boolean);

    clarity("set", `${String(eventName)}_${key}`, clarityValue);
  });
}

export function trackEvent<K extends keyof PlausibleEvents>(
  eventName: K,
  props?: PlausibleEvents[K]
) {
  if (typeof window === "undefined") return;

  try {
    window.plausible?.(eventName, {
      props: props ?? ({} as PlausibleEvents[K]),
    });
  } catch {
    // Analytics must never block the product action being measured.
  }

  try {
    sendToClarity(eventName, props);
  } catch {
    // Keep each analytics sink independent and best effort.
  }
}
