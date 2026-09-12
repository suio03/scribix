export type Platform = "instagram" | "youtube" | "tiktok" | "linkedin";

export type CheckLevel = "block" | "warn";

export type Check = {
  platform: Platform;
  level: CheckLevel;
  code: string;
  message: string;
  suggestion: string;
};

export type ProbeStatus = "pending" | "ok" | "unknown" | "failed";

export type MediaDetails = {
  filename: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  rotation: number | null;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  probeStatus: ProbeStatus;
  probeError: string | null;
};

type PlatformSpec = {
  label: string;
  minDurationSec: number;
  maxDurationSec: number;
  maxSizeBytes: number;
  containerFormats: string[];
  videoCodecs: string[];
};

export const PLATFORMS: Platform[] = ["instagram", "youtube", "tiktok", "linkedin"];

export const PUBLISH_PLATFORMS = ["youtube", "tiktok", "linkedin"] as const;

export const SPECS: Record<Platform, PlatformSpec> = {
  instagram: {
    label: "Instagram Reels",
    minDurationSec: 3,
    maxDurationSec: 900,
    maxSizeBytes: 1_000_000_000,
    containerFormats: ["mp4", "mov"],
    videoCodecs: ["avc1", "hvc1", "hev1"],
  },
  youtube: {
    label: "YouTube",
    minDurationSec: 1,
    maxDurationSec: 12 * 60 * 60,
    maxSizeBytes: 256_000_000_000,
    containerFormats: ["mp4", "mov", "webm"],
    videoCodecs: ["avc1", "hvc1", "hev1", "vp08", "vp09", "av01"],
  },
  linkedin: {
    label: "LinkedIn",
    minDurationSec: 3,
    maxDurationSec: 1800,
    maxSizeBytes: 500_000_000,
    containerFormats: ["mp4"],
    videoCodecs: ["avc1"],
  },
  tiktok: {
    label: "TikTok",
    minDurationSec: 3,
    maxDurationSec: 600,
    maxSizeBytes: 4_000_000_000,
    containerFormats: ["mp4", "mov", "webm"],
    videoCodecs: ["avc1", "hvc1", "hev1", "vp08", "vp09"],
  },
};

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function extensionOf(filename: string | null) {
  const match = filename?.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}

export function checkMedia(media: MediaDetails): Check[] {
  const checks: Check[] = [];
  const extension = extensionOf(media.filename);

  for (const platform of PLATFORMS) {
    const spec = SPECS[platform];

    if (media.probeStatus !== "ok") {
      checks.push({
        platform,
        level: "warn",
        code: "PROBE_UNAVAILABLE",
        message: `${spec.label}: ClipFlight couldn't read all of this video's details, so some checks were skipped`,
        suggestion: "Export the video as a web-optimized MP4, or review its requirements manually.",
      });
    }

    if (extension && !spec.containerFormats.includes(extension)) {
      checks.push({
        platform,
        level: "block",
        code: "CONTAINER_UNSUPPORTED",
        message: `${spec.label} doesn't support .${extension} files`,
        suggestion: `Convert to ${spec.containerFormats.join(" / ").toUpperCase()}.`,
      });
    }

    if (platform === "linkedin" && media.sizeBytes !== null && media.sizeBytes < 75_000) {
      checks.push({ platform, level: "block", code: "FILE_TOO_SMALL", message: "LinkedIn: video must be at least 75 KB", suggestion: "Upload a larger MP4 video." });
    }

    if (media.sizeBytes !== null && media.sizeBytes > spec.maxSizeBytes) {
      checks.push({
        platform,
        level: "block",
        code: "FILE_TOO_LARGE",
        message: `${spec.label}: file size is over the current limit`,
        suggestion: "Lower the bitrate or shorten the video, then upload again.",
      });
    }

    if (media.durationMs !== null) {
      const durationSec = media.durationMs / 1000;

      if (durationSec < spec.minDurationSec) {
        checks.push({
          platform,
          level: "block",
          code: "DURATION_TOO_SHORT",
          message: `${spec.label}: video is ${formatDuration(media.durationMs)}, under the ${spec.minDurationSec}s minimum`,
          suggestion: "Extend the video, then upload again.",
        });
      } else if (durationSec > spec.maxDurationSec) {
        checks.push({
          platform,
          level: "block",
          code: "DURATION_TOO_LONG",
          message: `${spec.label}: video is ${formatDuration(media.durationMs)}, over the ${Math.round(spec.maxDurationSec / 60)}-minute limit`,
          suggestion: "Trim the video, then upload again.",
        });
      }
    }

    if (media.videoCodec && !spec.videoCodecs.includes(media.videoCodec)) {
      checks.push({
        platform,
        level: "block",
        code: "VIDEO_CODEC_UNSUPPORTED",
        message: `${spec.label} doesn't support the ${media.videoCodec} video codec`,
        suggestion: "Convert to H.264 (avc1) for the widest compatibility.",
      });
    }
  }

  if (media.width !== null && media.height !== null) {
    const ratio = media.width / media.height;

    if (ratio > 1) {
      checks.push(
        {
          platform: "instagram",
          level: "warn",
          code: "LANDSCAPE_VIDEO",
          message: `Instagram Reels: landscape ${media.width}×${media.height} detected`,
          suggestion: "Crop to 9:16 portrait so the frame isn't too small or letterboxed.",
        },
        {
          platform: "youtube",
          level: "warn",
          code: "YOUTUBE_STANDARD_VIDEO",
          message: `YouTube: landscape ${media.width}×${media.height} will publish as a standard video`,
          suggestion: "Keep it landscape, or crop to portrait or square if you want a Short.",
        },
        {
          platform: "tiktok",
          level: "warn",
          code: "LANDSCAPE_VIDEO",
          message: `TikTok: landscape ${media.width}×${media.height} detected`,
          suggestion: "Crop to 9:16 portrait for full-screen viewing.",
        },
      );
    }

    const shortestSide = Math.min(media.width, media.height);
    const longestSide = Math.max(media.width, media.height);

    if (shortestSide < 360 || longestSide > 4096) {
      checks.push({
        platform: "tiktok",
        level: "block",
        code: "PICTURE_SIZE_INVALID",
        message: `TikTok: resolution ${media.width}×${media.height} is outside the 360–4096 px range`,
        suggestion: "Adjust the resolution so both width and height fall between 360–4096 px.",
      });
    }
  }

  if (media.durationMs !== null && media.durationMs > 3 * 60 * 1000) {
    checks.push({
      platform: "youtube",
      level: "warn",
      code: "YOUTUBE_LONG_FORM_DURATION",
      message: `YouTube: ${formatDuration(media.durationMs)} is over 3 minutes and will publish as a standard video`,
      suggestion: "Keep the full video, or trim it to 3 minutes or less if you want a Short.",
    });
  }

  if (media.fps !== null && (media.fps < 23 || media.fps > 60)) {
    checks.push({
      platform: "tiktok",
      level: "block",
      code: "FRAME_RATE_INVALID",
      message: `TikTok: frame rate ${media.fps.toFixed(2)} FPS is outside the 23–60 FPS range`,
      suggestion: "Convert to 24, 25, 30, or 60 FPS.",
    });
  }

  return checks;
}

export type YouTubeFormat = "short" | "standard" | "unknown";

export function classifyYouTubeFormat(media: MediaDetails): YouTubeFormat {
  if (media.durationMs === null || media.width === null || media.height === null) {
    return "unknown";
  }

  return media.width <= media.height && media.durationMs <= 3 * 60 * 1000
    ? "short"
    : "standard";
}
