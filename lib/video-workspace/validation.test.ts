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
import { VideoWorkspaceR2 } from "./r2-keys";
import {
  CandidateGenerationError,
  aiCandidateGenerationBlocked,
  alignAndValidateCandidateSet,
  buildCandidateAnalysisInput,
  candidateLimitForSourceDuration,
  parseProviderCandidateReviewResult,
  parseProviderCandidateSet,
} from "./candidate-generation";

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
    seg_01: { framingMode: "fill", crop: { x: 0.5, y: 0.5, zoom: 1.15 } },
    seg_02: { framingMode: "fit", crop: { x: 0.42, y: 0.5, zoom: 1.1 } },
  },
  captions: {
    enabled: true,
    templateId: "karaoke-v1",
    fontAssetId: "font_01",
    textColor: "#FFFFFF",
    highlightColor: "#FFD600",
    positionY: 0.78,
    maxCharsPerLine: 22,
    maxLines: 2,
    cues: [],
  },
  brand: {
    templateId: "corner-v1",
    logoAssetId: "logo_01",
    accentColor: "#FF5A1F",
    logoPosition: "top-right",
    logoScale: 0.16,
  },
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

test("accepts legacy crop specs and rejects unknown framing modes", () => {
  const legacy = {
    ...renderSpec,
    segments: {
      seg_01: { crop: renderSpec.segments.seg_01.crop },
      seg_02: { crop: renderSpec.segments.seg_02.crop },
    },
  };
  assert.equal(validateRenderSpec(legacy, edl).success, true);
  const invalid = {
    ...renderSpec,
    segments: {
      ...renderSpec.segments,
      seg_01: { ...renderSpec.segments.seg_01, framingMode: "stretch" },
    },
  };
  const result = validateRenderSpec(invalid, edl);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.issues.some((item) => item.path.endsWith(".framingMode")));
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

test("caption cues stay source-aligned and renderer templates remain controlled", () => {
  const valid = {
    ...renderSpec,
    captions: {
      ...renderSpec.captions,
      templateId: "boxed-v1",
      cues: [{
        id: "cue_0",
        segmentId: "seg_01",
        sourceStartMs: 120_000,
        sourceEndMs: 121_000,
        words: [{ text: "Hello", sourceStartMs: 120_000, sourceEndMs: 121_000 }],
      }],
    },
  };
  assert.equal(validateRenderSpec(valid, edl).success, true);
  const invalid = {
    ...valid,
    captions: {
      ...valid.captions,
      cues: [{
        ...valid.captions.cues[0],
        sourceStartMs: 119_000,
      }],
    },
    brand: { ...valid.brand, templateId: "../../filters" },
  };
  const result = validateRenderSpec(invalid, edl);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.issues.some((item) => item.path.endsWith("sourceStartMs")));
    assert.ok(result.issues.some((item) => item.path === "$.brand.templateId"));
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

test("AI candidate generation is available only before a successful analysis", () => {
  assert.equal(aiCandidateGenerationBlocked("draft", []), false);
  assert.equal(aiCandidateGenerationBlocked("failed", []), false);
  assert.equal(aiCandidateGenerationBlocked("candidates_ready", []), true);
  assert.equal(aiCandidateGenerationBlocked("editing", ["manual"]), true);
  assert.equal(aiCandidateGenerationBlocked("failed", ["ai"]), true);
});

test("short-video duration policy adapts candidate count without padding", () => {
  assert.equal(candidateLimitForSourceDuration(15_000), 1);
  assert.equal(candidateLimitForSourceDuration(45_000), 1);
  assert.equal(candidateLimitForSourceDuration(45_001), 3);
  assert.equal(candidateLimitForSourceDuration(180_000), 3);
  assert.equal(candidateLimitForSourceDuration(180_001), 5);

  const empty = parseProviderCandidateSet({ candidates: [] }, 3);
  const analysis = buildCandidateAnalysisInput(candidateTranscriptFixture(), 120_000);
  const result = alignAndValidateCandidateSet(
    empty,
    analysis.words,
    analysis.sourceDurationMs
  );
  assert.deepEqual(result.candidates, []);
});

test("AI candidates stop at 45 seconds and edited timelines stop at 60 seconds", () => {
  const analysis = buildCandidateAnalysisInput(candidateTranscriptFixture(), 120_000);
  const provider = parseProviderCandidateSet({
    candidates: [providerCandidate(0.9, 10_000, 56_000)],
  });
  const candidates = alignAndValidateCandidateSet(
    provider,
    analysis.words,
    analysis.sourceDurationMs
  );
  assert.deepEqual(candidates.candidates, []);

  assert.equal(validateEdl({
    schemaVersion: 1,
    segments: [{ id: "s0", sourceStartMs: 0, sourceEndMs: 60_000, order: 0 }],
  }, { sourceDurationMs: 120_000 }).success, true);
  assert.equal(validateEdl({
    schemaVersion: 1,
    segments: [{ id: "s0", sourceStartMs: 0, sourceEndMs: 60_001, order: 0 }],
  }, { sourceDurationMs: 120_000 }).success, false);
});

test("edited timelines allow no more than three source segments", () => {
  const result = validateEdl({
    schemaVersion: 1,
    segments: Array.from({ length: 4 }, (_, index) => ({
      id: `s${index}`,
      sourceStartMs: index * 2_000,
      sourceEndMs: index * 2_000 + 1_000,
      order: index,
    })),
  }, { sourceDurationMs: 120_000 });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.issues.some((item) => item.code === "segment_count"));
  }
});

test("candidate generation aligns every range to real word boundaries", () => {
  const analysis = buildCandidateAnalysisInput(candidateTranscriptFixture(), 120_000);
  assert.match(analysis.text, /10000-10800:word10/);
  const provider = parseProviderCandidateSet({
    candidates: [
      {
        theme: "One useful moment",
        hook: "The first important idea",
        reason: "The continuous excerpt forms a complete explanation.",
        score: 0.91,
        segments: [{ startMs: 10_240, endMs: 30_190 }],
      },
    ],
  });
  const result = alignAndValidateCandidateSet(
    provider,
    analysis.words,
    analysis.sourceDurationMs,
    () => "candidate_aligned"
  );
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].segments.length, 1);
  const starts = new Set(analysis.words.map((word) => word.startMs));
  const ends = new Set(analysis.words.map((word) => word.endMs));
  for (const segment of result.candidates[0].segments) {
    assert.equal(starts.has(segment.startMs), true);
    assert.equal(ends.has(segment.endMs), true);
  }
});

test("candidate generation removes invalid and highly duplicated ranges", () => {
  const analysis = buildCandidateAnalysisInput(candidateTranscriptFixture(), 120_000);
  const provider = parseProviderCandidateSet({
    candidates: [
      providerCandidate(0.95, 10_000, 31_000),
      providerCandidate(0.8, 10_300, 30_800),
      providerCandidate(0.7, 115_000, 130_000),
    ],
  });
  let nextId = 0;
  const result = alignAndValidateCandidateSet(
    provider,
    analysis.words,
    analysis.sourceDurationMs,
    () => `candidate_${nextId += 1}`
  );
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].score, 0.95);
});

test("provider candidate parsing rejects unknown fields before persistence", () => {
  assert.throws(
    () => parseProviderCandidateSet({
      candidates: [{
        ...providerCandidate(0.8, 10_000, 30_000),
        shellCommand: "ffmpeg -i secret",
      }],
    }),
    CandidateGenerationError
  );
});

test("candidate completeness review accepts, adjusts, and rejects without rewriting copy", () => {
  const proposed = parseProviderCandidateSet({
    candidates: [
      providerCandidate(0.95, 10_000, 30_000),
      providerCandidate(0.9, 40_000, 60_000),
      providerCandidate(0.85, 70_000, 90_000),
    ],
  });
  const result = parseProviderCandidateReviewResult({
    reviews: [
      reviewDecision(0, "accept", 0.98, 10_500, 29_500),
      reviewDecision(1, "adjust", 0.9, 38_000, 62_000),
      reviewDecision(2, "reject", 0.3, 68_000, 92_000),
    ],
  }, proposed);

  assert.equal(result.candidates.candidates.length, 2);
  assert.deepEqual(
    result.candidates.candidates[0],
    proposed.candidates[0],
    "accept must retain the original candidate rather than reviewer edits"
  );
  assert.deepEqual(
    result.candidates.candidates[1].segments,
    [{ startMs: 38_000, endMs: 62_000 }]
  );
  assert.equal(result.candidates.candidates[1].theme, proposed.candidates[1].theme);
});

test("candidate completeness review requires exactly one strict decision per proposal", () => {
  const proposed = parseProviderCandidateSet({
    candidates: [
      providerCandidate(0.95, 10_000, 30_000),
      providerCandidate(0.9, 40_000, 60_000),
    ],
  });
  assert.throws(
    () => parseProviderCandidateReviewResult({
      reviews: [reviewDecision(0, "accept", 0.98, 10_000, 30_000)],
    }, proposed),
    CandidateGenerationError
  );
  assert.throws(
    () => parseProviderCandidateReviewResult({
      reviews: [
        reviewDecision(0, "accept", 0.98, 10_000, 30_000),
        { ...reviewDecision(0, "reject", 0.2, 40_000, 60_000), extra: true },
      ],
    }, proposed),
    CandidateGenerationError
  );
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
    candidateId: null,
    segmentIndex: null,
    segmentId: null,
    sourceStartMs: null,
    sourceEndMs: null,
    proxySourceStartMs: null,
    proxySourceEndMs: null,
    proxyVersion: null,
    kind: "final",
    provider: "cloudflare-containers",
    providerJobId: "provider_01",
    status: "completed",
    attempt: 1,
    idempotencyKey: "version_01-final-vertical-1080p-v1",
    outputAssetId: "asset_01",
    coverAssetId: "cover_01",
    errorCode: null,
  });
  assert.equal(completed.success, true);

  const preview = validateRenderJob({
    schemaVersion: 1,
    id: "job_02",
    userId: "user_01",
    projectId: "project_01",
    projectVersionId: null,
    candidateId: "candidate_01",
    segmentIndex: 0,
    segmentId: "s0",
    sourceStartMs: 10_000,
    sourceEndMs: 35_000,
    proxySourceStartMs: 5_000,
    proxySourceEndMs: 40_000,
    proxyVersion: 1,
    kind: "preview",
    provider: null,
    providerJobId: null,
    status: "queued",
    attempt: 0,
    idempotencyKey: "preview-project-candidate-0-v1",
    outputAssetId: "asset_02",
    coverAssetId: null,
    errorCode: null,
  });
  assert.equal(preview.success, true);

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

test("video workspace R2 keys are deterministic and reject unsafe segments", () => {
  assert.equal(
    VideoWorkspaceR2.previewProxyKey("user_01", "project_01", "candidate_01", "seg_01", 2),
    "users/user_01/video-projects/project_01/proxies/candidate_01/seg_01-2.mp4"
  );
  assert.equal(
    VideoWorkspaceR2.finalVideoKey("user_01", "project_01", "render_01"),
    "users/user_01/video-projects/project_01/renders/render_01/final-9x16.mp4"
  );
  assert.throws(() => VideoWorkspaceR2.coverKey("../other", "project_01", "render_01"));
  assert.throws(() => VideoWorkspaceR2.brandAssetKey("user_01", "asset_01", "../png"));
});

function candidateTranscriptFixture() {
  const words = Array.from({ length: 120 }, (_, index) => ({
    text: `word${index}`,
    start: index * 1_000,
    end: index * 1_000 + 800,
    speaker: "A",
  }));
  return {
    words,
    utterances: Array.from({ length: 12 }, (_, index) => ({
      text: words.slice(index * 10, index * 10 + 10).map((word) => word.text).join(" "),
      start: index * 10_000,
      end: index * 10_000 + 9_800,
      speaker: "A",
    })),
  };
}

function providerCandidate(score: number, startMs: number, endMs: number) {
  return {
    theme: `Candidate ${score}`,
    hook: "A strong opening line",
    reason: "The excerpt is complete and understandable by itself.",
    score,
    segments: [{ startMs, endMs }],
  };
}

function reviewDecision(
  candidateIndex: number,
  verdict: "accept" | "adjust" | "reject",
  completenessScore: number,
  startMs: number,
  endMs: number
) {
  return {
    candidateIndex,
    verdict,
    completenessScore,
    completenessReason: verdict === "reject"
      ? "The spoken excerpt depends on missing context."
      : "The spoken excerpt is independently understandable.",
    segments: [{ startMs, endMs }],
  };
}
