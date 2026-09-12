export const YOUTUBE_PRIVACY_STATUSES = ["private", "unlisted", "public"] as const;

export type YouTubePrivacyStatus = (typeof YOUTUBE_PRIVACY_STATUSES)[number];

export function isYouTubePrivacyStatus(value: unknown): value is YouTubePrivacyStatus {
  return YOUTUBE_PRIVACY_STATUSES.some((status) => status === value);
}
