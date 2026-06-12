import type { YouTubeTranscriptError } from "@/lib/youtube-transcripts";

export function youtubeRequestId(): string {
  return `yt_${crypto.randomUUID().slice(0, 8)}`;
}

export function statusForYouTubeTranscriptError(code: YouTubeTranscriptError["code"]): number {
  switch (code) {
    case "invalid_youtube_url":
      return 400;
    case "transcripts_unavailable":
      return 404;
    case "track_not_found":
    case "empty_transcript":
      return 422;
    case "youtube_duration_exceeds_tier":
      return 413;
    default:
      return 502;
  }
}
