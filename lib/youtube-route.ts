import type { YouTubeCaptionServiceErrorCode } from "@/lib/youtube-caption-service";

export function youtubeRequestId(): string {
  return `yt_${crypto.randomUUID().slice(0, 8)}`;
}

export function statusForYouTubeCaptionError(code: YouTubeCaptionServiceErrorCode): number {
  switch (code) {
    case "invalid_youtube_url":
      return 400;
    case "transcripts_unavailable":
      return 404;
    case "video_unplayable":
      return 422;
    case "missing_youtube_service_config":
      return 503;
    case "track_not_found":
    case "empty_transcript":
      return 422;
    default:
      return 502;
  }
}
