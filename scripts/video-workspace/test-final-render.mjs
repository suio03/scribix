import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderFinal } from "../../containers/video-preview/final-render.mjs";

const directory = await mkdtemp(join(tmpdir(), "scribix-final-render-test-"));
const captionCues = process.env.TEST_FINAL_CAPTIONS === "1" ? [{
  id: "cue_0",
  segmentId: "s0",
  sourceStartMs: 600,
  sourceEndMs: 1800,
  words: [
    { text: "Hello", sourceStartMs: 600, sourceEndMs: 1100 },
    { text: "Scribix", sourceStartMs: 1100, sourceEndMs: 1800 },
  ],
}] : [];
try {
  const source = join(directory, "source.mp4");
  command("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=6",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=6",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-y", source,
  ]);
  const lease = {
    schemaVersion: 1,
    jobId: "fixture-final",
    kind: "final",
    sourceUrl: "https://example.test/source.mp4",
    outputVideoUrl: "https://example.test/final.mp4",
    outputCoverUrl: "https://example.test/cover.jpg",
    logoUrl: null,
    fontUrl: null,
    urlsExpireInSec: 3600,
    edl: {
      schemaVersion: 1,
      segments: [
        { id: "s0", sourceStartMs: 500, sourceEndMs: 2500, order: 0 },
        { id: "s1", sourceStartMs: 3500, sourceEndMs: 5500, order: 1 },
      ],
    },
    renderSpec: {
      schemaVersion: 1,
      outputPresetId: "vertical-1080p-v1",
      canvas: { width: 1080, height: 1920, fps: 30, backgroundColor: "#000000" },
      segments: {
        s0: { framingMode: "fill", crop: { x: 0.25, y: 0.5, zoom: 1 }, framingRanges: [
          { sourceStartMs: 1000, framingMode: "fill", crop: { x: 1, y: 0, zoom: 1.5 } },
          { sourceStartMs: 1800, framingMode: "fit", crop: { x: 0.5, y: 0.5, zoom: 1 } },
        ] },
        s1: { framingMode: "fit", crop: { x: 0.75, y: 0.5, zoom: 1.1 } },
      },
      captions: {
        enabled: true,
        templateId: "karaoke-v1",
        fontAssetId: null,
        textColor: "#FFFFFF",
        highlightColor: "#FFD600",
        positionY: 0.78,
        maxCharsPerLine: 22,
        maxLines: 2,
        cues: captionCues,
      },
      brand: {
        templateId: "signature-v1",
        logoAssetId: null,
        accentColor: "#FF5A1F",
        logoPosition: "top-right",
        logoScale: 0.16,
      },
      audio: { gainDb: 0, normalize: true, fadeInMs: 100, fadeOutMs: 250 },
      coverTimelineMs: 1200,
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
  const rendered = await renderFinal({
    lease,
    workingDirectory: directory,
    sourceInput: source,
  });
  const cover = await readFile(rendered.coverPath);
  if (
    rendered.output.width !== 1080 || rendered.output.height !== 1920 ||
    rendered.output.videoCodec !== "h264" || rendered.output.audioCodec !== "aac" ||
    Math.abs(rendered.output.durationMs - 4000) > 150 || cover.byteLength === 0
  ) {
    throw new Error("final_render_fixture_invalid");
  }
  console.log(JSON.stringify({
    event: "final_render_fixture_passed",
    durationMs: rendered.output.durationMs,
    width: rendered.output.width,
    height: rendered.output.height,
    videoCodec: rendered.output.videoCodec,
    audioCodec: rendered.output.audioCodec,
    coverBytes: cover.byteLength,
  }));
  // A 23.976fps B-frame source cuts just after a fractional crop boundary.
  // The subject switches sides: any next-shot frame using the old crop is black.
  const cutSource = join(directory, "cut-source.mp4");
  command("ffmpeg", ["-v", "error", "-f", "lavfi", "-i",
    "nullsrc=s=640x360:r=24000/1001:d=4,geq=lum='if(lt(N,50),if(lt(X,320),235,16),if(lt(X,320),16,235))':cb=128:cr=128",
    "-c:v", "libx264", "-bf", "3", "-g", "240", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-y", cutSource]);
  const cutLease = structuredClone(lease);
  cutLease.edl.segments = [{ id: "s0", sourceStartMs: 0, sourceEndMs: 3500, order: 0 }];
  cutLease.renderSpec.segments = { s0: { framingMode: "auto", crop: { x: 0, y: .5, zoom: 1 },
    autoFraming: { schemaVersion: 1, analyzer: "fixture", sourceStartMs: 0, sourceEndMs: 3500,
      points: [{ sourceMs: 0, framingMode: "fill", crop: { x: 0, y: .5, zoom: 1 } },
               { sourceMs: 2080, framingMode: "fill", crop: { x: 1, y: .5, zoom: 1.1 } }] } } };
  cutLease.renderSpec.captions.enabled = false;
  cutLease.renderSpec.brand.templateId = null;
  const cutRender = await renderFinal({ lease: cutLease, workingDirectory: directory, sourceInput: cutSource });
  const pixels = spawnSync("ffmpeg", ["-v", "error", "-i", cutRender.outputPath,
    "-vf", "crop=100:100:490:910,scale=1:1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], { maxBuffer: 1000000 });
  if (pixels.status !== 0) throw new Error(pixels.stderr.toString());
  if (pixels.stdout.length < 90*3 || [...pixels.stdout].some(value => value < 220)) {
    throw new Error("shot_boundary_used_wrong_crop");
  }
  console.log(JSON.stringify({event: "shot_boundary_frames_passed", frames: pixels.stdout.length/3}));

} finally {
  await rm(directory, { recursive: true, force: true });
}

function command(binary, args) {
  const result = spawnSync(binary, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `${binary}_failed`);
}
