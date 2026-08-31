export const VIDEO_WORKSPACE_SCHEMA_VERSION = 1 as const;

export const VIDEO_WORKSPACE_LIMITS = {
  maxCandidates: 5,
  maxSegments: 20,
  minSegmentDurationMs: 250,
  maxSegmentDurationMs: 180_000,
  maxTimelineDurationMs: 180_000,
  maxSourceDurationMs: 12 * 60 * 60 * 1000,
} as const;

export const FINAL_VIDEO_PRESET = {
  id: "vertical-1080p-v1",
  width: 1080,
  height: 1920,
  fps: 30,
  videoCodec: "h264",
  pixelFormat: "yuv420p",
  audioCodec: "aac",
  audioChannels: 2,
  container: "mp4",
} as const;

export const PREVIEW_PROXY_PRESET = {
  id: "preview-720p-v1",
  maxDimension: 1280,
  videoCodec: "h264",
  audioCodec: "aac",
  container: "mp4",
  handleDurationMs: 5_000,
} as const;

export const CAPTION_TEMPLATE_IDS = ["karaoke-v1"] as const;
export type CaptionTemplateId = (typeof CAPTION_TEMPLATE_IDS)[number];

export const MEDIA_ASSET_KINDS = [
  "source",
  "preview_proxy",
  "final_video",
  "cover",
  "logo",
  "font",
] as const;
export type MediaAssetKind = (typeof MEDIA_ASSET_KINDS)[number];

export const MEDIA_ASSET_STATUSES = [
  "pending",
  "uploading",
  "ready",
  "failed",
  "deleted",
] as const;
export type MediaAssetStatus = (typeof MEDIA_ASSET_STATUSES)[number];

export const RENDER_JOB_KINDS = ["preview", "final"] as const;
export type RenderJobKind = (typeof RENDER_JOB_KINDS)[number];

export const RENDER_JOB_STATUSES = [
  "draft",
  "queued",
  "preparing",
  "running",
  "uploading",
  "completed",
  "failed",
  "canceled",
] as const;
export type RenderJobStatus = (typeof RENDER_JOB_STATUSES)[number];

export const RENDER_ERROR_CODES = [
  "invalid_source",
  "unsupported_codec",
  "invalid_edl",
  "invalid_render_spec",
  "asset_missing",
  "download_failed",
  "render_failed",
  "upload_failed",
  "provider_unavailable",
  "job_timed_out",
] as const;
export type RenderErrorCode = (typeof RENDER_ERROR_CODES)[number];

export type EdlSegment = {
  id: string;
  sourceStartMs: number;
  sourceEndMs: number;
  order: number;
};

export type Edl = {
  schemaVersion: typeof VIDEO_WORKSPACE_SCHEMA_VERSION;
  segments: EdlSegment[];
};

export type CropSpec = {
  x: number;
  y: number;
  zoom: number;
};

export type RenderSpec = {
  schemaVersion: typeof VIDEO_WORKSPACE_SCHEMA_VERSION;
  outputPresetId: typeof FINAL_VIDEO_PRESET.id;
  canvas: {
    width: typeof FINAL_VIDEO_PRESET.width;
    height: typeof FINAL_VIDEO_PRESET.height;
    fps: typeof FINAL_VIDEO_PRESET.fps;
    backgroundColor: string;
  };
  segments: Record<string, { crop: CropSpec }>;
  captions: {
    templateId: CaptionTemplateId;
    fontAssetId: string | null;
    textColor: string;
    highlightColor: string;
    positionY: number;
  };
  brand: {
    templateId: string | null;
    logoAssetId: string | null;
  };
  audio: {
    gainDb: number;
    normalize: boolean;
    fadeInMs: number;
    fadeOutMs: number;
  };
  coverTimelineMs: number;
};

export type CandidateSegment = {
  startMs: number;
  endMs: number;
};

export type ClipCandidate = {
  schemaVersion: typeof VIDEO_WORKSPACE_SCHEMA_VERSION;
  id: string;
  theme: string;
  hook: string;
  reason: string;
  score: number;
  segments: CandidateSegment[];
};

export type CandidateSet = {
  schemaVersion: typeof VIDEO_WORKSPACE_SCHEMA_VERSION;
  candidates: ClipCandidate[];
};

export type MediaAsset = {
  schemaVersion: typeof VIDEO_WORKSPACE_SCHEMA_VERSION;
  id: string;
  userId: string;
  projectId: string | null;
  kind: MediaAssetKind;
  status: MediaAssetStatus;
  r2Key: string | null;
  mimeType: string;
  bytes: number | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  expiresAt: string | null;
};

export type RenderJob = {
  schemaVersion: typeof VIDEO_WORKSPACE_SCHEMA_VERSION;
  id: string;
  userId: string;
  projectId: string;
  projectVersionId: string;
  kind: RenderJobKind;
  provider: string;
  providerJobId: string | null;
  status: RenderJobStatus;
  attempt: number;
  idempotencyKey: string;
  outputAssetId: string | null;
  errorCode: RenderErrorCode | null;
};

export type RenderDispatchMessage = {
  schemaVersion: typeof VIDEO_WORKSPACE_SCHEMA_VERSION;
  jobId: string;
};

export function edlTimelineDurationMs(edl: Edl): number {
  return edl.segments.reduce(
    (duration, segment) => duration + segment.sourceEndMs - segment.sourceStartMs,
    0
  );
}
