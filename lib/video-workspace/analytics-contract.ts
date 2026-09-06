// Public event properties exclude entity IDs, content, filenames and media URLs.
export const VIDEO_ANALYTICS_EVENTS = [
  "video_home_cta_click", "video_upload_started", "video_upload_failed",
  "video_project_failed", "video_editor_load_failed", "video_editor_save_failed", "video_export_request_failed",
  "video_candidate_request_failed", "video_manual_request_failed",
  "video_project_created", "video_upload_completed", "video_candidates_started",
  "video_candidates_completed", "video_manual_clip_ready",
  "video_editor_opened", "video_edit_saved", "video_render_requested",
  "video_render_completed", "video_render_failed", "video_render_downloaded",
  "video_external_edit_required", "video_candidate_selected",
] as const;
export type VideoAnalyticsEvent = (typeof VIDEO_ANALYTICS_EVENTS)[number];
export type VideoAnalyticsProperties = Record<string, string | number | boolean>;
const NUMERIC_KEYS = new Set(["elapsed_ms", "file_size_mb", "duration_sec", "elapsedMs"]);
const ENUMS: Record<string, readonly string[]> = {
  plan_tier: ["free", "basic", "pro"],
  error_code: ["generation_failed", "review_failed", "persistence_failed", "request_failed", "conflict", "limit",
    "invalid_source", "unsupported_codec", "invalid_edl", "invalid_render_spec", "asset_missing",
    "download_failed", "render_failed", "upload_failed", "provider_unavailable", "job_timed_out"],
};
export function publicVideoProperties(input: unknown): VideoAnalyticsProperties {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const result: VideoAnalyticsProperties = {};
  for (const [key, value] of Object.entries(input)) {
    if (NUMERIC_KEYS.has(key) && typeof value === "number" && Number.isFinite(value) && value >= 0) {
      result[key === "elapsedMs" ? "elapsed_ms" : key] = Math.round(value);
    } else if (Object.hasOwn(ENUMS, key) && typeof value === "string" && ENUMS[key].includes(value)) {
      result[key] = value;
    }
  }
  return result;
}
