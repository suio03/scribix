import { VIDEO_WORKSPACE_LIMITS } from "./contracts";

export const SUPPORTED_SOURCE_CONTAINERS = ["mp4", "mov", "webm", "matroska"] as const;
export const SUPPORTED_SOURCE_VIDEO_CODECS = ["h264", "hevc", "vp8", "vp9"] as const;
export const SUPPORTED_SOURCE_AUDIO_CODECS = [
  "aac",
  "mp3",
  "opus",
  "vorbis",
  "alac",
  "pcm_s16le",
  "pcm_s24le",
  "pcm_s32le",
  "pcm_f32le",
] as const;

export type SourceProbe = {
  formatNames: string[];
  durationMs: number;
  video: {
    codec: string;
    width: number;
    height: number;
  } | null;
  audio: {
    codec: string;
    channels: number;
  } | null;
};

export type SourcePolicyResult =
  | { supported: true }
  | {
      supported: false;
      errorCode: "invalid_source" | "unsupported_codec";
      reason:
        | "invalid_duration"
        | "missing_video"
        | "missing_audio"
        | "invalid_dimensions"
        | "unsupported_container"
        | "unsupported_video_codec"
        | "unsupported_audio_codec";
    };

function includesValue(values: readonly string[], value: string): boolean {
  return values.includes(value.toLowerCase());
}

export function checkSourcePolicy(source: SourceProbe): SourcePolicyResult {
  if (
    !Number.isInteger(source.durationMs) ||
    source.durationMs <= 0 ||
    source.durationMs > VIDEO_WORKSPACE_LIMITS.maxSourceDurationMs
  ) {
    return { supported: false, errorCode: "invalid_source", reason: "invalid_duration" };
  }
  if (!source.video) {
    return { supported: false, errorCode: "invalid_source", reason: "missing_video" };
  }
  if (!source.audio) {
    return { supported: false, errorCode: "invalid_source", reason: "missing_audio" };
  }
  if (
    !Number.isInteger(source.video.width) ||
    !Number.isInteger(source.video.height) ||
    source.video.width <= 0 ||
    source.video.height <= 0 ||
    source.video.width > 16_384 ||
    source.video.height > 16_384
  ) {
    return { supported: false, errorCode: "invalid_source", reason: "invalid_dimensions" };
  }
  if (!source.formatNames.some((format) => includesValue(SUPPORTED_SOURCE_CONTAINERS, format))) {
    return { supported: false, errorCode: "unsupported_codec", reason: "unsupported_container" };
  }
  if (!includesValue(SUPPORTED_SOURCE_VIDEO_CODECS, source.video.codec)) {
    return { supported: false, errorCode: "unsupported_codec", reason: "unsupported_video_codec" };
  }
  if (!includesValue(SUPPORTED_SOURCE_AUDIO_CODECS, source.audio.codec)) {
    return { supported: false, errorCode: "unsupported_codec", reason: "unsupported_audio_codec" };
  }
  if (!Number.isInteger(source.audio.channels) || source.audio.channels <= 0 || source.audio.channels > 8) {
    return { supported: false, errorCode: "invalid_source", reason: "missing_audio" };
  }
  return { supported: true };
}
