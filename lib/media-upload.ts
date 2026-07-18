export const MULTIPART_PART_BYTES = 100 * 1024 * 1024;
export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

export const AUDIO_EXTENSIONS = new Set([
  "3ga", "8svx", "aac", "ac3", "aif", "aiff", "alac", "amr", "ape", "au", "dss",
  "flac", "flv", "m4a", "m4b", "m4p", "m4r", "mogg", "mp3", "mp4", "mpga",
  "oga", "ogg", "opus", "qcp", "tta", "voc", "wav", "webm", "wma", "wv",
]);

export const VIDEO_EXTENSIONS = new Set([
  "avi", "flv", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm", "wmv",
]);

export function mediaExtension(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext || ext === filename.toLowerCase() || ext.length > 8) return null;
  return ext;
}

export function isAllowedMedia(filename: string, mime: string, isVideo: boolean): boolean {
  const ext = mediaExtension(filename);
  const normalizedMime = mime.toLowerCase();
  if (isVideo) {
    return ext !== null && VIDEO_EXTENSIONS.has(ext) && normalizedMime.startsWith("video/");
  }
  if (!normalizedMime.startsWith("audio/")) return false;
  return ext === null || AUDIO_EXTENSIONS.has(ext);
}

export function isUploadExpired(createdAt: string, now = Date.now()): boolean {
  const timestamp = new Date(
    createdAt.includes("T") ? createdAt : `${createdAt.replace(" ", "T")}Z`
  ).getTime();
  return Number.isFinite(timestamp) && now - timestamp >= UPLOAD_TTL_MS;
}
