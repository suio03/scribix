import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  FINAL_VIDEO_PRESET,
  VIDEO_WORKSPACE_SCHEMA_VERSION,
  type Edl,
  type RenderSpec,
} from "./contracts";
import {
  ContractValidationError,
  parseContract,
  validateCandidateSet,
  validateEdl,
  validateMediaAsset,
  validateRenderDispatchMessage,
  validateRenderJob,
  validateRenderSpec,
} from "./validation";
import { checkSourcePolicy } from "./source-policy";

const edl: Edl = {
  schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION,
  segments: [
    { id: "seg_01", sourceStartMs: 120_000, sourceEndMs: 145_000, order: 0 },
    { id: "seg_02", sourceStartMs: 380_000, sourceEndMs: 405_000, order: 1 },
  ],
};

const renderSpec: RenderSpec = {
  schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION,
  outputPresetId: FINAL_VIDEO_PRESET.id,
  canvas: {
    width: FINAL_VIDEO_PRESET.width,
    height: FINAL_VIDEO_PRESET.height,
    fps: FINAL_VIDEO_PRESET.fps,
    backgroundColor: "#000000",
  },
  segments: {
    seg_01: { crop: { x: 0.5, y: 0.5, zoom: 1.15 } },
    seg_02: { crop: { x: 0.42, y: 0.5, zoom: 1.1 } },
  },
  captions: {
    templateId: "karaoke-v1",
    fontAssetId: "font_01",
    textColor: "#FFFFFF",
    highlightColor: "#FFD600",
    positionY: 0.78,
  },
  brand: { templateId: "brand_01", logoAssetId: "logo_01" },
  audio: { gainDb: 0, normalize: true, fadeInMs: 0, fadeOutMs: 250 },
  coverTimelineMs: 4_800,
};

test("accepts a valid EDL and render spec", () => {
  assert.equal(validateEdl(edl, { sourceDurationMs: 600_000 }).success, true);
  assert.equal(validateRenderSpec(renderSpec, edl).success, true);
});

test("accepts the renderer prototype fixture through the shared contract", () => {
  const fixture = JSON.parse(
    readFileSync(resolve(process.cwd(), "scripts/video-workspace/fixtures/render-v1.json"), "utf8")
  ) as { sourceDurationMs: number; edl: unknown; renderSpec: unknown };
  const edlResult = validateEdl(fixture.edl, { sourceDurationMs: fixture.sourceDurationMs });
  assert.equal(edlResult.success, true);
  if (edlResult.success) {
    assert.equal(validateRenderSpec(fixture.renderSpec, edlResult.data).success, true);
  }
});

test("rejects non-integer, overlapping, and out-of-bounds source ranges", () => {
  const result = validateEdl(
    {
      schemaVersion: 1,
      segments: [
        { id: "seg_01", sourceStartMs: 1_000.5, sourceEndMs: 5_000, order: 0 },
        { id: "seg_02", sourceStartMs: 4_000, sourceEndMs: 20_000, order: 1 },
      ],
    },
    { sourceDurationMs: 10_000 }
  );
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.issues.some((item) => item.code === "invalid_integer"));
    assert.ok(result.issues.some((item) => item.code === "out_of_range"));
  }
});

test("rejects renderer fields outside the versioned contract", () => {
  const result = validateRenderSpec(
    {
      ...renderSpec,
      ffmpegFilter: "movie=/etc/passwd",
      segments: {
        ...renderSpec.segments,
        seg_01: {
          ...renderSpec.segments.seg_01,
          crop: { ...renderSpec.segments.seg_01.crop, zoom: 10 },
        },
      },
    },
    edl
  );
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.issues.some((item) => item.path === "$.ffmpegFilter"));
    assert.ok(result.issues.some((item) => item.path.endsWith(".zoom")));
  }
});

test("requires every EDL segment and a cover point inside the timeline", () => {
  const result = validateRenderSpec(
    {
      ...renderSpec,
      segments: { seg_01: renderSpec.segments.seg_01 },
      coverTimelineMs: 50_000,
    },
    edl
  );
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.issues.some((item) => item.code === "missing_segment"));
    assert.ok(result.issues.some((item) => item.path === "$.coverTimelineMs"));
  }
});

test("validates structured candidate output against source time", () => {
  const result = validateCandidateSet(
    {
      schemaVersion: 1,
      candidates: [
        {
          schemaVersion: 1,
          id: "candidate_01",
          theme: "A complete idea",
          hook: "This is the surprising part.",
          reason: "The excerpt is understandable without earlier context.",
          score: 0.86,
          segments: [{ startMs: 12_000, endMs: 20_000 }],
        },
      ],
    },
    { sourceDurationMs: 60_000 }
  );
  assert.equal(result.success, true);
});

test("media assets reject path traversal object keys", () => {
  const result = validateMediaAsset({
    schemaVersion: 1,
    id: "asset_01",
    userId: "user_01",
    projectId: "project_01",
    kind: "source",
    status: "ready",
    r2Key: "users/user_01/../other/source.mp4",
    mimeType: "video/mp4",
    bytes: 1_000,
    durationMs: 5_000,
    width: 1920,
    height: 1080,
    expiresAt: null,
  });
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.issues.some((item) => item.code === "invalid_object_key"));
});

test("job state and dispatch contracts remain deterministic", () => {
  const completed = validateRenderJob({
    schemaVersion: 1,
    id: "job_01",
    userId: "user_01",
    projectId: "project_01",
    projectVersionId: "version_01",
    kind: "final",
    provider: "aws-batch",
    providerJobId: "provider_01",
    status: "completed",
    attempt: 1,
    idempotencyKey: "version_01-final-vertical-1080p-v1",
    outputAssetId: "asset_01",
    errorCode: null,
  });
  assert.equal(completed.success, true);

  const dispatch = validateRenderDispatchMessage({ schemaVersion: 1, jobId: "job_01" });
  assert.equal(dispatch.success, true);
  assert.equal(
    validateRenderDispatchMessage({ schemaVersion: 1, jobId: "job_01", signedUrl: "secret" }).success,
    false
  );
});

test("parseContract throws typed validation errors", () => {
  assert.throws(
    () => parseContract(validateEdl({ schemaVersion: 2, segments: [] })),
    ContractValidationError
  );
});

test("source policy accepts the M0 container and codec baseline", () => {
  assert.deepEqual(
    checkSourcePolicy({
      formatNames: ["mov", "mp4"],
      durationMs: 8_000,
      video: { codec: "h264", width: 1280, height: 720 },
      audio: { codec: "aac", channels: 2 },
    }),
    { supported: true }
  );
});

test("source policy returns stable failures for bad and unsupported media", () => {
  assert.deepEqual(
    checkSourcePolicy({
      formatNames: ["avi"],
      durationMs: 8_000,
      video: { codec: "mpeg4", width: 1280, height: 720 },
      audio: { codec: "aac", channels: 2 },
    }),
    { supported: false, errorCode: "unsupported_codec", reason: "unsupported_container" }
  );
  assert.deepEqual(
    checkSourcePolicy({
      formatNames: ["mp4"],
      durationMs: 0,
      video: null,
      audio: null,
    }),
    { supported: false, errorCode: "invalid_source", reason: "invalid_duration" }
  );
});
