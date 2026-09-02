export const POC_CASE_IDS = ["continuous-15s", "continuous-30s", "splice-45s"];

export function pocBenchmarkCases(sourceDurationMs) {
  const definitions = sourceDurationMs >= 1_500_000 ? [
    {
      id: "continuous-15s",
      ranges: [[60_000, 75_000]],
    },
    {
      id: "continuous-30s",
      ranges: [[780_000, 810_000]],
    },
    {
      id: "splice-45s",
      ranges: [[150_000, 165_000], [780_000, 795_000], [1_450_000, 1_465_000]],
    },
  ] : [
    {
      id: "continuous-15s",
      ranges: [[5_000, 20_000]],
    },
    {
      id: "continuous-30s",
      ranges: [[30_000, 60_000]],
    },
    {
      id: "splice-45s",
      ranges: [[65_000, 80_000], [95_000, 110_000], [125_000, 140_000]],
    },
  ];
  const requiredDurationMs = Math.max(
    ...definitions.flatMap((definition) => definition.ranges.map((range) => range[1]))
  );
  if (sourceDurationMs < requiredDurationMs) {
    throw new Error(`source_too_short:${requiredDurationMs}`);
  }
  return definitions.map((definition) => ({
    id: definition.id,
    segments: definition.ranges.map(([sourceStartMs, sourceEndMs], index) => ({
      id: `s${index}`,
      sourceStartMs,
      sourceEndMs,
      order: index,
    })),
  }));
}

export function pocRenderLease(benchmarkCase, jobId = `poc-${benchmarkCase.id}`) {
  const segments = Object.fromEntries(benchmarkCase.segments.map((segment, index) => [
    segment.id,
    { crop: { x: [0.35, 0.5, 0.65][index] ?? 0.5, y: 0.5, zoom: 1 } },
  ]));
  const cues = benchmarkCase.segments.map((segment, index) => ({
    id: `cue-${index}`,
    segmentId: segment.id,
    sourceStartMs: segment.sourceStartMs + 500,
    sourceEndMs: segment.sourceStartMs + 2_500,
    words: [
      {
        text: "Scribix",
        sourceStartMs: segment.sourceStartMs + 500,
        sourceEndMs: segment.sourceStartMs + 1_400,
      },
      {
        text: "test",
        sourceStartMs: segment.sourceStartMs + 1_400,
        sourceEndMs: segment.sourceStartMs + 2_500,
      },
    ],
  }));
  return {
    schemaVersion: 1,
    jobId,
    kind: "final",
    sourceUrl: "https://poc.invalid/source.mp4",
    outputVideoUrl: "https://poc.invalid/output.mp4",
    outputCoverUrl: "https://poc.invalid/cover.jpg",
    logoUrl: null,
    fontUrl: null,
    urlsExpireInSec: 3_600,
    edl: { schemaVersion: 1, segments: benchmarkCase.segments },
    renderSpec: {
      schemaVersion: 1,
      outputPresetId: "vertical-1080p-v1",
      canvas: { width: 1080, height: 1920, fps: 30, backgroundColor: "#000000" },
      segments,
      captions: {
        enabled: true,
        templateId: "karaoke-v1",
        fontAssetId: null,
        textColor: "#FFFFFF",
        highlightColor: "#FFD600",
        positionY: 0.78,
        maxCharsPerLine: 22,
        maxLines: 2,
        cues,
      },
      brand: {
        templateId: "signature-v1",
        logoAssetId: null,
        accentColor: "#FF5A1F",
        logoPosition: "top-right",
        logoScale: 0.16,
      },
      audio: { gainDb: 0, normalize: true, fadeInMs: 100, fadeOutMs: 250 },
      coverTimelineMs: 1_200,
    },
    preset: {
      id: "vertical-1080p-v1",
      width: 1080,
      height: 1920,
      fps: 30,
      videoCodec: "h264",
      pixelFormat: "yuv420p",
      audioCodec: "aac",
      audioChannels: 2,
      container: "mp4",
    },
  };
}

export function estimatePocContainerCost(elapsedMs, idleSeconds = 30) {
  const activeSeconds = elapsedMs / 1_000;
  const provisionedSeconds = activeSeconds + idleSeconds;
  const cpu = activeSeconds * 0.000020;
  const memory = 3 * provisionedSeconds * 0.0000025;
  const disk = 6 * provisionedSeconds * 0.00000007;
  return round(cpu + memory + disk, 6);
}

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
