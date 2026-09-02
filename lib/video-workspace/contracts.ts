export const VIDEO_WORKSPACE_SCHEMA_VERSION = 1 as const;

export const VIDEO_WORKSPACE_LIMITS = {
  maxCandidates: 5,
  maxSegments: 3,
  maxAiCandidateDurationMs: 45_000,
  directEditMaxSourceDurationMs: 45_000,
  minSegmentDurationMs: 250,
  maxSegmentDurationMs: 60_000,
  maxTimelineDurationMs: 60_000,
  maxSourceDurationMs: 12 * 60 * 60 * 1000,
  maxActiveFinalJobsPerUser: 2,
  maxFinalJobsPerUserPerDay: 20,
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

export const PREVIEW_PROXY_AUTO_CANDIDATES = VIDEO_WORKSPACE_LIMITS.maxCandidates;
export const PREVIEW_PROXY_RETENTION_DAYS = 7 as const;
export const PREVIEW_PROXY_URL_TTL_SECONDS = 15 * 60;
export const FINAL_RENDER_URL_TTL_SECONDS = 60 * 60;

export const CAPTION_TEMPLATE_IDS = ["karaoke-v1", "boxed-v1", "minimal-v1"] as const;
export type CaptionTemplateId = (typeof CAPTION_TEMPLATE_IDS)[number];

export const BRAND_TEMPLATE_IDS = ["corner-v1", "signature-v1"] as const;
export type BrandTemplateId = (typeof BRAND_TEMPLATE_IDS)[number];

export const LOGO_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type LogoPosition = (typeof LOGO_POSITIONS)[number];

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

export type CaptionWord = {
  text: string;
  sourceStartMs: number;
  sourceEndMs: number;
};

export type CaptionCue = {
  id: string;
  segmentId: string;
  sourceStartMs: number;
  sourceEndMs: number;
  words: CaptionWord[];
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
    enabled: boolean;
    templateId: CaptionTemplateId;
    fontAssetId: string | null;
    textColor: string;
    highlightColor: string;
    positionY: number;
    maxCharsPerLine: number;
    maxLines: number;
    cues: CaptionCue[];
  };
  brand: {
    templateId: BrandTemplateId | null;
    logoAssetId: string | null;
    accentColor: string;
    logoPosition: LogoPosition;
    logoScale: number;
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
  projectVersionId: string | null;
  candidateId: string | null;
  segmentIndex: number | null;
  segmentId: string | null;
  sourceStartMs: number | null;
  sourceEndMs: number | null;
  proxySourceStartMs: number | null;
  proxySourceEndMs: number | null;
  proxyVersion: number | null;
  kind: RenderJobKind;
  provider: string | null;
  providerJobId: string | null;
  status: RenderJobStatus;
  attempt: number;
  idempotencyKey: string;
  outputAssetId: string | null;
  coverAssetId: string | null;
  errorCode: RenderErrorCode | null;
};

export type RenderDispatchMessage = {
  schemaVersion: typeof VIDEO_WORKSPACE_SCHEMA_VERSION;
  jobId: string;
};

export type PreviewJobLease = {
  schemaVersion: typeof VIDEO_WORKSPACE_SCHEMA_VERSION;
  jobId: string;
  kind: "preview";
  sourceUrl: string;
  outputUrl: string;
  urlsExpireInSec: number;
  segment: {
    id: string;
    index: number;
    sourceStartMs: number;
    sourceEndMs: number;
    proxySourceStartMs: number;
    proxySourceEndMs: number;
  };
  preset: typeof PREVIEW_PROXY_PRESET;
};

export type FinalJobLease = {
  schemaVersion: typeof VIDEO_WORKSPACE_SCHEMA_VERSION;
  jobId: string;
  kind: "final";
  sourceUrl: string;
  outputVideoUrl: string;
  outputCoverUrl: string;
  logoUrl: string | null;
  fontUrl: string | null;
  urlsExpireInSec: number;
  edl: Edl;
  renderSpec: RenderSpec;
  preset: typeof FINAL_VIDEO_PRESET;
};

export type PreviewJobResult = {
  status: "completed";
  output: {
    bytes: number;
    durationMs: number;
    width: number;
    height: number;
    videoCodec: "h264";
    audioCodec: "aac" | null;
  };
};

export type PreviewJobFailure = {
  status: "failed";
  errorCode: RenderErrorCode;
};

export type FinalJobResult = {
  status: "completed";
  output: {
    video: {
      bytes: number;
      durationMs: number;
      width: number;
      height: number;
      videoCodec: "h264";
      audioCodec: "aac";
    };
    cover: {
      bytes: number;
      width: number;
      height: number;
      mimeType: "image/jpeg";
    };
  };
};

export function edlTimelineDurationMs(edl: Edl): number {
  return edl.segments.reduce(
    (duration, segment) => duration + segment.sourceEndMs - segment.sourceStartMs,
    0
  );
}
