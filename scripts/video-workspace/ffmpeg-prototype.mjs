import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const fixturePath = resolve(import.meta.dirname, "fixtures/render-v1.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const FINAL_WIDTH = fixture.renderSpec.canvas.width;
const FINAL_HEIGHT = fixture.renderSpec.canvas.height;
const FINAL_FPS = fixture.renderSpec.canvas.fps;
assert.equal(fixture.renderSpec.schemaVersion, 1);
assert.equal(fixture.renderSpec.outputPresetId, "vertical-1080p-v1");
assert.equal(FINAL_WIDTH, 1080);
assert.equal(FINAL_HEIGHT, 1920);
assert.equal(FINAL_FPS, 30);
const SEGMENTS = [...fixture.edl.segments]
  .sort((left, right) => left.order - right.order)
  .map((segment) => ({
    startMs: segment.sourceStartMs,
    endMs: segment.sourceEndMs,
    crop: fixture.renderSpec.segments[segment.id]?.crop,
  }));
const TOTAL_DURATION_MS = SEGMENTS.reduce(
  (duration, segment) => duration + segment.endMs - segment.startMs,
  0
);

function commandExists(command, versionArgument = "-version") {
  return spawnSync(command, [versionArgument], { encoding: "utf8" }).status === 0;
}

function filterAvailable(ffmpeg, filterName) {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-filters"], { encoding: "utf8" });
  return result.status === 0 && new RegExp(`\\b${filterName}\\b`).test(result.stdout);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout}` : "";
    throw new Error(`${basename(command)} failed with exit code ${result.status}.${detail}`);
  }
  return result.stdout ?? "";
}

function seconds(milliseconds) {
  assert(Number.isInteger(milliseconds) && milliseconds >= 0);
  return (milliseconds / 1000).toFixed(3);
}

function cropFilter(index, crop) {
  assert(crop, `missing crop for segment ${index}`);
  for (const value of [crop.x, crop.y]) assert(value >= 0 && value <= 1);
  assert(crop.zoom >= 1 && crop.zoom <= 4);
  const baseWidth = `min(iw\,ih*${FINAL_WIDTH}/${FINAL_HEIGHT})`;
  const baseHeight = `min(ih\,iw*${FINAL_HEIGHT}/${FINAL_WIDTH})`;
  const width = `(${baseWidth})/${crop.zoom}`;
  const height = `(${baseHeight})/${crop.zoom}`;
  return [
    `[${index}:v]crop=w='${width}':h='${height}':x='(iw-ow)*${crop.x}':y='(ih-oh)*${crop.y}'`,
    `scale=${FINAL_WIDTH}:${FINAL_HEIGHT}:flags=lanczos`,
    `fps=${FINAL_FPS}`,
    "setsar=1",
    "setpts=PTS-STARTPTS",
    `format=yuv420p[v${index}]`,
  ].join(",");
}

function escapeFilterPath(path) {
  return path.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'");
}

function createSource(ffmpeg, sourcePath) {
  run(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=1280x720:rate=30:duration=8",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=48000:duration=8",
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    "-y",
    sourcePath,
  ]);
}

function createCaptionFixture(path) {
  writeFileSync(
    path,
    `[Script Info]
ScriptType: v4.00+
PlayResX: ${FINAL_WIDTH}
PlayResY: ${FINAL_HEIGHT}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,72,&H00FFFFFF,&H0000D6FF,&H00101010,&H90000000,-1,0,0,0,100,100,0,0,1,4,1,2,80,80,350,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.20,0:00:01.90,Default,,0,0,0,,FIRST SEGMENT
Dialogue: 0,0:00:02.20,0:00:04.30,Default,,0,0,0,,SECOND SEGMENT
`,
    "utf8"
  );
}

function createCaptionImages(pangoView, workingDirectory) {
  return ["FIRST SEGMENT", "SECOND SEGMENT"].map((text, index) => {
    const outputPath = join(workingDirectory, `caption-${index + 1}.png`);
    run(pangoView, [
      "--no-display",
      "--pixels",
      "--font=Arial Bold 72",
      "--foreground=#ffffff",
      "--background=transparent",
      "--align=center",
      "--width=900",
      "--margin=24",
      `--text=${text}`,
      `--output=${outputPath}`,
    ]);
    return outputPath;
  });
}

function render(ffmpeg, sourcePath, captionsPath, captionImages, outputPath) {
  const args = ["-hide_banner", "-loglevel", "warning"];
  for (const segment of SEGMENTS) {
    args.push(
      "-ss",
      seconds(segment.startMs),
      "-t",
      seconds(segment.endMs - segment.startMs),
      "-i",
      sourcePath
    );
  }
  args.push(
    "-f",
    "lavfi",
    "-t",
    seconds(TOTAL_DURATION_MS),
    "-i",
    "color=c=0xFFD600@0.88:s=240x80:r=30"
  );
  for (const captionImage of captionImages) {
    args.push(
      "-loop",
      "1",
      "-framerate",
      String(FINAL_FPS),
      "-t",
      seconds(TOTAL_DURATION_MS),
      "-i",
      captionImage
    );
  }

  const filters = [];
  SEGMENTS.forEach((segment, index) => {
    filters.push(cropFilter(index, segment.crop));
    filters.push(`[${index}:a]aresample=48000,asetpts=PTS-STARTPTS[a${index}]`);
  });
  filters.push(
    `${SEGMENTS.map((_, index) => `[v${index}][a${index}]`).join("")}concat=n=${SEGMENTS.length}:v=1:a=1[joinedv][joineda]`
  );
  if (captionImages.length === 0) {
    filters.push(
      `[joinedv]subtitles=filename='${escapeFilterPath(captionsPath)}'[captioned]`
    );
  } else {
    const firstCaptionInput = SEGMENTS.length + 1;
    filters.push(
      `[joinedv][${firstCaptionInput}:v]overlay=x=(W-w)/2:y=H*0.78-h/2:enable='between(t,0.20,1.90)'[caption1]`
    );
    filters.push(
      `[caption1][${firstCaptionInput + 1}:v]overlay=x=(W-w)/2:y=H*0.78-h/2:enable='between(t,2.20,4.30)'[captioned]`
    );
  }
  filters.push(`[${SEGMENTS.length}:v]format=rgba[logo]`);
  filters.push("[captioned][logo]overlay=W-w-48:48:shortest=1[outv]");
  filters.push(
    `[joineda]volume=${fixture.renderSpec.audio.gainDb}dB${
      fixture.renderSpec.audio.normalize ? ",loudnorm=I=-16:TP=-1.5:LRA=11" : ""
    },afade=t=in:st=0:d=${seconds(fixture.renderSpec.audio.fadeInMs)},afade=t=out:st=${seconds(
      TOTAL_DURATION_MS - fixture.renderSpec.audio.fadeOutMs
    )}:d=${seconds(fixture.renderSpec.audio.fadeOutMs)}[outa]`
  );

  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[outv]",
    "-map",
    "[outa]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-metadata",
    "comment=scribix-video-workspace-prototype-v1",
    "-y",
    outputPath
  );
  run(ffmpeg, args);
}

function createCover(ffmpeg, outputPath, coverPath) {
  run(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-ss",
    seconds(fixture.renderSpec.coverTimelineMs),
    "-i",
    outputPath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    "-update",
    "1",
    "-y",
    coverPath,
  ]);
}

function probe(ffprobe, path) {
  return JSON.parse(
    run(
      ffprobe,
      ["-v", "error", "-show_entries", "format=duration:stream=index,codec_type,codec_name,width,height,pix_fmt,channels", "-of", "json", path],
      { capture: true }
    )
  );
}

function verifyVideo(metadata) {
  const video = metadata.streams.find((stream) => stream.codec_type === "video");
  const audio = metadata.streams.find((stream) => stream.codec_type === "audio");
  assert(video, "final output must contain a video stream");
  assert(audio, "final output must contain an audio stream");
  assert.equal(video.codec_name, "h264");
  assert.equal(video.pix_fmt, "yuv420p");
  assert.equal(video.width, FINAL_WIDTH);
  assert.equal(video.height, FINAL_HEIGHT);
  assert.equal(audio.codec_name, "aac");
  assert.equal(audio.channels, 2);
  const durationMs = Number(metadata.format.duration) * 1000;
  assert(Math.abs(durationMs - TOTAL_DURATION_MS) <= 150, `unexpected duration: ${durationMs}ms`);
}

function verifyCover(metadata) {
  const video = metadata.streams.find((stream) => stream.codec_type === "video");
  assert(video, "cover must contain an image stream");
  assert.equal(video.width, FINAL_WIDTH);
  assert.equal(video.height, FINAL_HEIGHT);
}

const keepOutput = process.argv.includes("--keep");
const explicitOutputIndex = process.argv.indexOf("--output-dir");
const explicitOutput = explicitOutputIndex >= 0 ? process.argv[explicitOutputIndex + 1] : null;
if (explicitOutputIndex >= 0 && (!explicitOutput || explicitOutput.startsWith("-"))) {
  throw new Error("--output-dir requires a directory path");
}

const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
if (!commandExists(ffmpeg) || !commandExists(ffprobe)) {
  console.error("video_workspace_tool_missing: install ffmpeg and ffprobe or set FFMPEG_PATH/FFPROBE_PATH");
  process.exit(2);
}

const workingDirectory = explicitOutput
  ? resolve(explicitOutput)
  : mkdtempSync(join(tmpdir(), "scribix-video-workspace-prototype-"));
mkdirSync(workingDirectory, { recursive: true });
const sourcePath = join(workingDirectory, "synthetic-source.mp4");
const captionsPath = join(workingDirectory, "captions.ass");
const outputPath = join(workingDirectory, "final-9x16.mp4");
const coverPath = join(workingDirectory, "cover.jpg");

const hasSubtitlesFilter = filterAvailable(ffmpeg, "subtitles");
const pangoView = process.env.PANGO_VIEW_PATH || "pango-view";
if (!hasSubtitlesFilter && !commandExists(pangoView, "--version")) {
  console.error(
    "unsupported_renderer_build: ffmpeg lacks the subtitles filter and pango-view fallback is unavailable"
  );
  process.exit(2);
}
const captionMode = hasSubtitlesFilter ? "ass" : "pango-overlay-fallback";

createSource(ffmpeg, sourcePath);
createCaptionFixture(captionsPath);
const captionImages = hasSubtitlesFilter ? [] : createCaptionImages(pangoView, workingDirectory);
render(ffmpeg, sourcePath, captionsPath, captionImages, outputPath);
createCover(ffmpeg, outputPath, coverPath);
verifyVideo(probe(ffprobe, outputPath));
verifyCover(probe(ffprobe, coverPath));

const version = run(ffmpeg, ["-version"], { capture: true }).split("\n")[0];
console.log(
  JSON.stringify(
    {
      ok: true,
      ffmpeg: version,
      finalVideo: outputPath,
      cover: coverPath,
      durationMs: TOTAL_DURATION_MS,
      captionMode,
      kept: Boolean(explicitOutput || keepOutput),
    },
    null,
    2
  )
);

if (!explicitOutput && !keepOutput) rmSync(workingDirectory, { recursive: true, force: true });
