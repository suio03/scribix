import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { renderFinal } from "../../containers/video-preview/final-render.mjs";

const manifest = JSON.parse(await readFile(
  join(import.meta.dirname, "fixtures/render-benchmark-v1.json"),
  "utf8"
));
assert.equal(manifest.cases.length, 24);
assert.equal(new Set(manifest.cases.map((item) => item.id)).size, 24);

const directory = await mkdtemp(join(tmpdir(), "scribix-render-benchmark-"));
try {
  const sources = new Map();
  for (const sourceId of new Set(manifest.cases.map((item) => item.source))) {
    const [shape, audioMode] = sourceId.split("-");
    const size = shape === "portrait" ? "360x640" : shape === "square" ? "480x480" : "640x360";
    const path = join(directory, `${sourceId}.mp4`);
    const args = [
      "-hide_banner", "-nostdin", "-loglevel", "error",
      "-f", "lavfi", "-i", `testsrc2=size=${size}:rate=30:duration=2.4`,
    ];
    if (audioMode === "audio") {
      args.push("-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2.4");
    }
    args.push("-c:v", "libx264", "-pix_fmt", "yuv420p");
    if (audioMode === "audio") args.push("-c:a", "aac", "-shortest");
    args.push("-y", path);
    command("ffmpeg", args);
    sources.set(sourceId, path);
  }
  const logoPath = join(directory, "logo.png");
  command("ffmpeg", [
    "-hide_banner", "-nostdin", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=0xff5a1f:s=348x176",
    "-vf", "drawbox=x=12:y=12:w=324:h=152:color=white:t=8",
    "-frames:v", "1", "-y", logoPath,
  ]);

  const timings = [];
  for (const item of manifest.cases) {
    const started = performance.now();
    const lease = fixtureLease(item);
    const rendered = await renderFinal({
      lease,
      workingDirectory: directory,
      sourceInput: sources.get(item.source),
      logoPath,
    });
    assert.equal(rendered.output.width, 1080, item.id);
    assert.equal(rendered.output.height, 1920, item.id);
    assert.equal(rendered.output.videoCodec, "h264", item.id);
    assert.equal(rendered.output.audioCodec, "aac", item.id);
    assert.ok(Math.abs(rendered.output.durationMs - 1_200) <= 250, item.id);
    const cover = await readFile(rendered.coverPath);
    assert.ok(cover.byteLength > 0, item.id);
    timings.push(Math.round(performance.now() - started));
  }
  const sorted = [...timings].sort((left, right) => left - right);
  console.log(JSON.stringify({
    event: "render_benchmark_passed",
    suite: manifest.suite,
    cases: timings.length,
    sourceProfiles: sources.size,
    elapsedMs: timings.reduce((sum, value) => sum + value, 0),
    perCaseMs: {
      p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
      p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
      max: sorted.at(-1),
    },
  }));
} finally {
  await rm(directory, { recursive: true, force: true });
}

function fixtureLease(item) {
  const segments = item.segments === 2
    ? [
        { id: "s0", sourceStartMs: 100, sourceEndMs: 700, order: 0 },
        { id: "s1", sourceStartMs: 1_400, sourceEndMs: 2_000, order: 1 },
      ]
    : [{ id: "s0", sourceStartMs: 100, sourceEndMs: 1_300, order: 0 }];
  const cues = segments.map((segment, index) => ({
    id: `cue-${index}`,
    segmentId: segment.id,
    sourceStartMs: segment.sourceStartMs + 50,
    sourceEndMs: segment.sourceEndMs - 50,
    words: [
      { text: "Scribix", sourceStartMs: segment.sourceStartMs + 50, sourceEndMs: segment.sourceStartMs + 250 },
      { text: "preview", sourceStartMs: segment.sourceStartMs + 250, sourceEndMs: segment.sourceStartMs + 450 },
      { text: "match", sourceStartMs: segment.sourceStartMs + 450, sourceEndMs: segment.sourceEndMs - 50 },
    ],
  }));
  return {
    schemaVersion: 1,
    jobId: item.id,
    kind: "final",
    sourceUrl: "https://example.invalid/source.mp4",
    outputVideoUrl: "https://example.invalid/final.mp4",
    outputCoverUrl: "https://example.invalid/cover.jpg",
    logoUrl: null,
    fontUrl: null,
    urlsExpireInSec: 3600,
    edl: { schemaVersion: 1, segments },
    renderSpec: {
      schemaVersion: 1,
      outputPresetId: "vertical-1080p-v1",
      canvas: { width: 1080, height: 1920, fps: 30, backgroundColor: "#000000" },
      segments: Object.fromEntries(segments.map((segment) => [segment.id, {
        crop: { x: item.x, y: item.y, zoom: item.zoom },
      }])),
      captions: {
        enabled: true,
        templateId: item.template,
        fontAssetId: null,
        textColor: "#ffffff",
        highlightColor: "#ff5a1f",
        positionY: 0.72,
        maxCharsPerLine: 15,
        maxLines: 2,
        cues,
      },
      brand: {
        templateId: item.brand,
        logoAssetId: "fixture-logo",
        accentColor: "#ff5a1f",
        logoPosition: item.position,
        logoScale: 0.16,
      },
      audio: {
        gainDb: item.source.endsWith("silent") ? 0 : -1,
        normalize: item.source.endsWith("audio"),
        fadeInMs: 50,
        fadeOutMs: 100,
      },
      coverTimelineMs: 600,
    },
    preset: {
      id: "vertical-1080p-v1", width: 1080, height: 1920, fps: 30,
      videoCodec: "h264", pixelFormat: "yuv420p", audioCodec: "aac",
      audioChannels: 2, container: "mp4",
    },
  };
}

function command(binary, args) {
  const result = spawnSync(binary, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `${binary}_failed`);
}
