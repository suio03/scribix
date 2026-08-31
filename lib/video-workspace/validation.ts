import {
  CAPTION_TEMPLATE_IDS,
  FINAL_VIDEO_PRESET,
  MEDIA_ASSET_KINDS,
  MEDIA_ASSET_STATUSES,
  RENDER_ERROR_CODES,
  RENDER_JOB_KINDS,
  RENDER_JOB_STATUSES,
  VIDEO_WORKSPACE_LIMITS,
  VIDEO_WORKSPACE_SCHEMA_VERSION,
  edlTimelineDurationMs,
  type CandidateSet,
  type ClipCandidate,
  type Edl,
  type MediaAsset,
  type RenderDispatchMessage,
  type RenderJob,
  type RenderSpec,
} from "./contracts";

export type ContractIssue = {
  path: string;
  code: string;
  message: string;
};

export type ContractResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ContractIssue[] };

export type TimelineValidationContext = {
  sourceDurationMs?: number;
  maxTimelineDurationMs?: number;
};

const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const HEX_COLOR = /^#[0-9A-F]{6}$/i;
const MAX_SAFE_BYTES = Number.MAX_SAFE_INTEGER;

function issue(path: string, code: string, message: string): ContractIssue {
  return { path, code, message };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  issues: ContractIssue[]
): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push(issue(`${path}.${key}`, "unknown_field", "Field is not part of schema version 1."));
    }
  }
}

function requireObject(
  value: unknown,
  path: string,
  issues: ContractIssue[]
): Record<string, unknown> | null {
  if (!isObject(value)) {
    issues.push(issue(path, "invalid_type", "Expected an object."));
    return null;
  }
  return value;
}

function requireString(
  value: unknown,
  path: string,
  issues: ContractIssue[],
  options: { maxLength?: number; allowEmpty?: boolean } = {}
): string | null {
  if (typeof value !== "string") {
    issues.push(issue(path, "invalid_type", "Expected a string."));
    return null;
  }
  if (!options.allowEmpty && value.trim().length === 0) {
    issues.push(issue(path, "empty_string", "Value cannot be empty."));
  }
  if (value.length > (options.maxLength ?? 512)) {
    issues.push(issue(path, "too_long", `Value cannot exceed ${options.maxLength ?? 512} characters.`));
  }
  return value;
}

function requireStableId(value: unknown, path: string, issues: ContractIssue[]): string | null {
  const id = requireString(value, path, issues, { maxLength: 128 });
  if (id !== null && !STABLE_ID.test(id)) {
    issues.push(issue(path, "invalid_id", "Expected a stable ID containing only letters, numbers, _ or -."));
  }
  return id;
}

function requireInteger(
  value: unknown,
  path: string,
  issues: ContractIssue[],
  min: number,
  max: number
): number | null {
  if (!Number.isInteger(value)) {
    issues.push(issue(path, "invalid_integer", "Expected an integer."));
    return null;
  }
  const number = value as number;
  if (number < min || number > max) {
    issues.push(issue(path, "out_of_range", `Expected a value from ${min} to ${max}.`));
  }
  return number;
}

function requireNumber(
  value: unknown,
  path: string,
  issues: ContractIssue[],
  min: number,
  max: number
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(issue(path, "invalid_number", "Expected a finite number."));
    return null;
  }
  if (value < min || value > max) {
    issues.push(issue(path, "out_of_range", `Expected a value from ${min} to ${max}.`));
  }
  return value;
}

function requireBoolean(value: unknown, path: string, issues: ContractIssue[]): boolean | null {
  if (typeof value !== "boolean") {
    issues.push(issue(path, "invalid_type", "Expected a boolean."));
    return null;
  }
  return value;
}

function requireNullableStableId(
  value: unknown,
  path: string,
  issues: ContractIssue[]
): string | null {
  if (value === null) return null;
  return requireStableId(value, path, issues);
}

function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: ContractIssue[]
): T | null {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    issues.push(issue(path, "invalid_enum", `Expected one of: ${allowed.join(", ")}.`));
    return null;
  }
  return value as T;
}

function requireSchemaVersion(value: unknown, issues: ContractIssue[]): void {
  if (value !== VIDEO_WORKSPACE_SCHEMA_VERSION) {
    issues.push(issue("$.schemaVersion", "unsupported_schema", "Only schemaVersion 1 is supported."));
  }
}

function validateSourceSegments(
  segments: unknown,
  path: string,
  issues: ContractIssue[],
  context: TimelineValidationContext,
  withIds: boolean
): Array<{ id?: string; startMs: number; endMs: number; order?: number }> {
  if (!Array.isArray(segments)) {
    issues.push(issue(path, "invalid_type", "Expected an array."));
    return [];
  }
  if (segments.length === 0 || segments.length > VIDEO_WORKSPACE_LIMITS.maxSegments) {
    issues.push(
      issue(path, "segment_count", `Expected 1 to ${VIDEO_WORKSPACE_LIMITS.maxSegments} segments.`)
    );
  }

  const parsed: Array<{ id?: string; startMs: number; endMs: number; order?: number }> = [];
  const ids = new Set<string>();
  const orders = new Set<number>();
  let totalDurationMs = 0;
  const sourceDurationMs = context.sourceDurationMs ?? VIDEO_WORKSPACE_LIMITS.maxSourceDurationMs;

  segments.forEach((raw, index) => {
    const segmentPath = `${path}[${index}]`;
    const segment = requireObject(raw, segmentPath, issues);
    if (!segment) return;
    const keys = withIds
      ? ["id", "sourceStartMs", "sourceEndMs", "order"]
      : ["startMs", "endMs"];
    hasOnlyKeys(segment, keys, segmentPath, issues);
    const id = withIds ? requireStableId(segment.id, `${segmentPath}.id`, issues) : null;
    const startMs = requireInteger(
      withIds ? segment.sourceStartMs : segment.startMs,
      `${segmentPath}.${withIds ? "sourceStartMs" : "startMs"}`,
      issues,
      0,
      sourceDurationMs
    );
    const endMs = requireInteger(
      withIds ? segment.sourceEndMs : segment.endMs,
      `${segmentPath}.${withIds ? "sourceEndMs" : "endMs"}`,
      issues,
      1,
      sourceDurationMs
    );
    const order = withIds
      ? requireInteger(segment.order, `${segmentPath}.order`, issues, 0, VIDEO_WORKSPACE_LIMITS.maxSegments - 1)
      : null;

    if (id !== null) {
      if (ids.has(id)) issues.push(issue(`${segmentPath}.id`, "duplicate_id", "Segment IDs must be unique."));
      ids.add(id);
    }
    if (order !== null) {
      if (orders.has(order)) {
        issues.push(issue(`${segmentPath}.order`, "duplicate_order", "Segment order values must be unique."));
      }
      orders.add(order);
    }
    if (startMs !== null && endMs !== null) {
      const durationMs = endMs - startMs;
      if (durationMs < VIDEO_WORKSPACE_LIMITS.minSegmentDurationMs) {
        issues.push(issue(segmentPath, "segment_too_short", "Segment is shorter than the safety minimum."));
      }
      if (durationMs > VIDEO_WORKSPACE_LIMITS.maxSegmentDurationMs) {
        issues.push(issue(segmentPath, "segment_too_long", "Segment exceeds the safety maximum."));
      }
      totalDurationMs += Math.max(0, durationMs);
      parsed.push({
        ...(id === null ? {} : { id }),
        startMs,
        endMs,
        ...(order === null ? {} : { order }),
      });
    }
  });

  if (withIds && orders.size === segments.length) {
    for (let order = 0; order < segments.length; order += 1) {
      if (!orders.has(order)) {
        issues.push(issue(path, "non_contiguous_order", "Segment order must be contiguous from zero."));
        break;
      }
    }
  }
  const maxTimelineDurationMs =
    context.maxTimelineDurationMs ?? VIDEO_WORKSPACE_LIMITS.maxTimelineDurationMs;
  if (totalDurationMs > maxTimelineDurationMs) {
    issues.push(issue(path, "timeline_too_long", "Combined segment duration exceeds the allowed timeline."));
  }

  const bySourceTime = [...parsed].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  for (let index = 1; index < bySourceTime.length; index += 1) {
    if (bySourceTime[index].startMs < bySourceTime[index - 1].endMs) {
      issues.push(issue(path, "overlapping_segments", "Source segments cannot overlap."));
      break;
    }
  }
  return parsed;
}

export function validateEdl(
  input: unknown,
  context: TimelineValidationContext = {}
): ContractResult<Edl> {
  const issues: ContractIssue[] = [];
  const value = requireObject(input, "$", issues);
  if (!value) return { success: false, issues };
  hasOnlyKeys(value, ["schemaVersion", "segments"], "$", issues);
  requireSchemaVersion(value.schemaVersion, issues);
  validateSourceSegments(value.segments, "$.segments", issues, context, true);
  return issues.length > 0
    ? { success: false, issues }
    : { success: true, data: input as Edl };
}

export function validateRenderSpec(input: unknown, edl: Edl): ContractResult<RenderSpec> {
  const issues: ContractIssue[] = [];
  const value = requireObject(input, "$", issues);
  if (!value) return { success: false, issues };
  hasOnlyKeys(
    value,
    ["schemaVersion", "outputPresetId", "canvas", "segments", "captions", "brand", "audio", "coverTimelineMs"],
    "$",
    issues
  );
  requireSchemaVersion(value.schemaVersion, issues);
  requireEnum(value.outputPresetId, [FINAL_VIDEO_PRESET.id], "$.outputPresetId", issues);

  const canvas = requireObject(value.canvas, "$.canvas", issues);
  if (canvas) {
    hasOnlyKeys(canvas, ["width", "height", "fps", "backgroundColor"], "$.canvas", issues);
    if (canvas.width !== FINAL_VIDEO_PRESET.width) {
      issues.push(issue("$.canvas.width", "invalid_preset_value", `Width must be ${FINAL_VIDEO_PRESET.width}.`));
    }
    if (canvas.height !== FINAL_VIDEO_PRESET.height) {
      issues.push(issue("$.canvas.height", "invalid_preset_value", `Height must be ${FINAL_VIDEO_PRESET.height}.`));
    }
    if (canvas.fps !== FINAL_VIDEO_PRESET.fps) {
      issues.push(issue("$.canvas.fps", "invalid_preset_value", `FPS must be ${FINAL_VIDEO_PRESET.fps}.`));
    }
    const color = requireString(canvas.backgroundColor, "$.canvas.backgroundColor", issues, { maxLength: 7 });
    if (color !== null && !HEX_COLOR.test(color)) {
      issues.push(issue("$.canvas.backgroundColor", "invalid_color", "Expected a six-digit hex color."));
    }
  }

  const segmentSpecs = requireObject(value.segments, "$.segments", issues);
  const edlIds = new Set(edl.segments.map((segment) => segment.id));
  if (segmentSpecs) {
    for (const [segmentId, rawSpec] of Object.entries(segmentSpecs)) {
      if (!STABLE_ID.test(segmentId) || !edlIds.has(segmentId)) {
        issues.push(issue(`$.segments.${segmentId}`, "unknown_segment", "Crop must reference an EDL segment ID."));
      }
      const spec = requireObject(rawSpec, `$.segments.${segmentId}`, issues);
      if (!spec) continue;
      hasOnlyKeys(spec, ["crop"], `$.segments.${segmentId}`, issues);
      const crop = requireObject(spec.crop, `$.segments.${segmentId}.crop`, issues);
      if (!crop) continue;
      hasOnlyKeys(crop, ["x", "y", "zoom"], `$.segments.${segmentId}.crop`, issues);
      requireNumber(crop.x, `$.segments.${segmentId}.crop.x`, issues, 0, 1);
      requireNumber(crop.y, `$.segments.${segmentId}.crop.y`, issues, 0, 1);
      requireNumber(crop.zoom, `$.segments.${segmentId}.crop.zoom`, issues, 1, 4);
    }
    for (const segmentId of edlIds) {
      if (!(segmentId in segmentSpecs)) {
        issues.push(issue(`$.segments.${segmentId}`, "missing_segment", "Every EDL segment requires a crop spec."));
      }
    }
  }

  const captions = requireObject(value.captions, "$.captions", issues);
  if (captions) {
    hasOnlyKeys(captions, ["templateId", "fontAssetId", "textColor", "highlightColor", "positionY"], "$.captions", issues);
    requireEnum(captions.templateId, CAPTION_TEMPLATE_IDS, "$.captions.templateId", issues);
    requireNullableStableId(captions.fontAssetId, "$.captions.fontAssetId", issues);
    for (const colorKey of ["textColor", "highlightColor"] as const) {
      const color = requireString(captions[colorKey], `$.captions.${colorKey}`, issues, { maxLength: 7 });
      if (color !== null && !HEX_COLOR.test(color)) {
        issues.push(issue(`$.captions.${colorKey}`, "invalid_color", "Expected a six-digit hex color."));
      }
    }
    requireNumber(captions.positionY, "$.captions.positionY", issues, 0, 1);
  }

  const brand = requireObject(value.brand, "$.brand", issues);
  if (brand) {
    hasOnlyKeys(brand, ["templateId", "logoAssetId"], "$.brand", issues);
    requireNullableStableId(brand.templateId, "$.brand.templateId", issues);
    requireNullableStableId(brand.logoAssetId, "$.brand.logoAssetId", issues);
  }

  const audio = requireObject(value.audio, "$.audio", issues);
  if (audio) {
    hasOnlyKeys(audio, ["gainDb", "normalize", "fadeInMs", "fadeOutMs"], "$.audio", issues);
    requireNumber(audio.gainDb, "$.audio.gainDb", issues, -24, 24);
    requireBoolean(audio.normalize, "$.audio.normalize", issues);
    requireInteger(audio.fadeInMs, "$.audio.fadeInMs", issues, 0, 10_000);
    requireInteger(audio.fadeOutMs, "$.audio.fadeOutMs", issues, 0, 10_000);
  }

  const timelineDurationMs = edlTimelineDurationMs(edl);
  requireInteger(value.coverTimelineMs, "$.coverTimelineMs", issues, 0, Math.max(0, timelineDurationMs - 1));
  return issues.length > 0
    ? { success: false, issues }
    : { success: true, data: input as RenderSpec };
}

function validateCandidate(
  input: unknown,
  path: string,
  issues: ContractIssue[],
  context: TimelineValidationContext
): void {
  const value = requireObject(input, path, issues);
  if (!value) return;
  hasOnlyKeys(value, ["schemaVersion", "id", "theme", "hook", "reason", "score", "segments"], path, issues);
  if (value.schemaVersion !== VIDEO_WORKSPACE_SCHEMA_VERSION) {
    issues.push(issue(`${path}.schemaVersion`, "unsupported_schema", "Only schemaVersion 1 is supported."));
  }
  requireStableId(value.id, `${path}.id`, issues);
  requireString(value.theme, `${path}.theme`, issues, { maxLength: 160 });
  requireString(value.hook, `${path}.hook`, issues, { maxLength: 240 });
  requireString(value.reason, `${path}.reason`, issues, { maxLength: 500 });
  requireNumber(value.score, `${path}.score`, issues, 0, 1);
  validateSourceSegments(value.segments, `${path}.segments`, issues, context, false);
}

export function validateClipCandidate(
  input: unknown,
  context: TimelineValidationContext = {}
): ContractResult<ClipCandidate> {
  const issues: ContractIssue[] = [];
  validateCandidate(input, "$", issues, context);
  return issues.length > 0
    ? { success: false, issues }
    : { success: true, data: input as ClipCandidate };
}

export function validateCandidateSet(
  input: unknown,
  context: TimelineValidationContext = {}
): ContractResult<CandidateSet> {
  const issues: ContractIssue[] = [];
  const value = requireObject(input, "$", issues);
  if (!value) return { success: false, issues };
  hasOnlyKeys(value, ["schemaVersion", "candidates"], "$", issues);
  requireSchemaVersion(value.schemaVersion, issues);
  if (!Array.isArray(value.candidates)) {
    issues.push(issue("$.candidates", "invalid_type", "Expected an array."));
  } else {
    const ids = new Set<string>();
    value.candidates.forEach((candidate, index) => {
      validateCandidate(candidate, `$.candidates[${index}]`, issues, context);
      if (isObject(candidate) && typeof candidate.id === "string") {
        if (ids.has(candidate.id)) {
          issues.push(issue(`$.candidates[${index}].id`, "duplicate_id", "Candidate IDs must be unique."));
        }
        ids.add(candidate.id);
      }
    });
  }
  return issues.length > 0
    ? { success: false, issues }
    : { success: true, data: input as CandidateSet };
}

export function validateMediaAsset(input: unknown): ContractResult<MediaAsset> {
  const issues: ContractIssue[] = [];
  const value = requireObject(input, "$", issues);
  if (!value) return { success: false, issues };
  hasOnlyKeys(value, ["schemaVersion", "id", "userId", "projectId", "kind", "status", "r2Key", "mimeType", "bytes", "durationMs", "width", "height", "expiresAt"], "$", issues);
  requireSchemaVersion(value.schemaVersion, issues);
  requireStableId(value.id, "$.id", issues);
  requireStableId(value.userId, "$.userId", issues);
  requireNullableStableId(value.projectId, "$.projectId", issues);
  requireEnum(value.kind, MEDIA_ASSET_KINDS, "$.kind", issues);
  requireEnum(value.status, MEDIA_ASSET_STATUSES, "$.status", issues);
  if (value.r2Key !== null) {
    const key = requireString(value.r2Key, "$.r2Key", issues, { maxLength: 1024 });
    if (key !== null && (key.startsWith("/") || key.includes("..") || /[\u0000-\u001F]/.test(key))) {
      issues.push(issue("$.r2Key", "invalid_object_key", "R2 key must be a relative canonical object key."));
    }
  }
  const mimeType = requireString(value.mimeType, "$.mimeType", issues, { maxLength: 127 });
  if (mimeType !== null && !MIME_TYPE.test(mimeType)) {
    issues.push(issue("$.mimeType", "invalid_mime_type", "Expected a canonical MIME type."));
  }
  for (const [key, max] of [["bytes", MAX_SAFE_BYTES], ["durationMs", VIDEO_WORKSPACE_LIMITS.maxSourceDurationMs], ["width", 16_384], ["height", 16_384]] as const) {
    if (value[key] !== null) requireInteger(value[key], `$.${key}`, issues, 0, max);
  }
  if (value.expiresAt !== null) {
    const expiresAt = requireString(value.expiresAt, "$.expiresAt", issues, { maxLength: 40 });
    if (expiresAt !== null && !Number.isFinite(Date.parse(expiresAt))) {
      issues.push(issue("$.expiresAt", "invalid_datetime", "Expected an ISO-compatible datetime."));
    }
  }
  return issues.length > 0
    ? { success: false, issues }
    : { success: true, data: input as MediaAsset };
}

export function validateRenderJob(input: unknown): ContractResult<RenderJob> {
  const issues: ContractIssue[] = [];
  const value = requireObject(input, "$", issues);
  if (!value) return { success: false, issues };
  hasOnlyKeys(value, ["schemaVersion", "id", "userId", "projectId", "projectVersionId", "kind", "provider", "providerJobId", "status", "attempt", "idempotencyKey", "outputAssetId", "errorCode"], "$", issues);
  requireSchemaVersion(value.schemaVersion, issues);
  for (const key of ["id", "userId", "projectId", "projectVersionId", "idempotencyKey"] as const) {
    requireStableId(value[key], `$.${key}`, issues);
  }
  requireEnum(value.kind, RENDER_JOB_KINDS, "$.kind", issues);
  requireStableId(value.provider, "$.provider", issues);
  requireNullableStableId(value.providerJobId, "$.providerJobId", issues);
  const status = requireEnum(value.status, RENDER_JOB_STATUSES, "$.status", issues);
  requireInteger(value.attempt, "$.attempt", issues, 0, 20);
  requireNullableStableId(value.outputAssetId, "$.outputAssetId", issues);
  const errorCode = value.errorCode === null
    ? null
    : requireEnum(value.errorCode, RENDER_ERROR_CODES, "$.errorCode", issues);
  if (status === "completed" && value.outputAssetId === null) {
    issues.push(issue("$.outputAssetId", "missing_output", "A completed job must reference its output asset."));
  }
  if (status === "failed" && errorCode === null) {
    issues.push(issue("$.errorCode", "missing_error", "A failed job must include a stable error code."));
  }
  if (status !== "failed" && errorCode !== null) {
    issues.push(issue("$.errorCode", "unexpected_error", "Only failed jobs may include an error code."));
  }
  return issues.length > 0
    ? { success: false, issues }
    : { success: true, data: input as RenderJob };
}

export function validateRenderDispatchMessage(input: unknown): ContractResult<RenderDispatchMessage> {
  const issues: ContractIssue[] = [];
  const value = requireObject(input, "$", issues);
  if (!value) return { success: false, issues };
  hasOnlyKeys(value, ["schemaVersion", "jobId"], "$", issues);
  requireSchemaVersion(value.schemaVersion, issues);
  requireStableId(value.jobId, "$.jobId", issues);
  return issues.length > 0
    ? { success: false, issues }
    : { success: true, data: input as RenderDispatchMessage };
}

export class ContractValidationError extends Error {
  constructor(public readonly issues: ContractIssue[]) {
    super(issues.map((item) => `${item.path}: ${item.message}`).join("; "));
    this.name = "ContractValidationError";
  }
}

export function parseContract<T>(result: ContractResult<T>): T {
  if ("issues" in result) throw new ContractValidationError(result.issues);
  return result.data;
}
