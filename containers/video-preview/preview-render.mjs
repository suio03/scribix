import { spawn } from "node:child_process";

export function validateLease(value) {
  if (!value || value.schemaVersion !== 1 || value.kind !== "preview" || typeof value.jobId !== "string") {
    throw renderError("invalid_render_spec");
  }
  if (!httpUrl(value.sourceUrl) || !httpUrl(value.outputUrl)) {
    throw renderError("invalid_render_spec");
  }
  const segment = value.segment;
  if (
    !segment ||
    !Number.isInteger(segment.index) || segment.index < 0 ||
    typeof segment.id !== "string" || !segment.id ||
    !validRange(segment.sourceStartMs, segment.sourceEndMs) ||
    !validRange(segment.proxySourceStartMs, segment.proxySourceEndMs) ||
    segment.proxySourceStartMs > segment.sourceStartMs ||
    segment.proxySourceEndMs < segment.sourceEndMs
  ) {
    throw renderError("invalid_edl");
  }
  const preset = value.preset;
  if (
    !preset ||
    preset.id !== "preview-720p-v1" ||
    preset.maxDimension !== 1280 ||
    preset.videoCodec !== "h264" ||
    preset.audioCodec !== "aac" ||
    preset.container !== "mp4"
  ) {
    throw renderError("invalid_render_spec");
  }
  return value;
}

export async function probeMedia(input) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size:stream=index,codec_type,codec_name,width,height",
    "-of", "json",
    input,
  ], "invalid_source");
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw renderError("invalid_source");
  }
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams?.find((stream) => stream.codec_type === "audio");
  const durationMs = Math.round(Number(parsed.format?.duration) * 1000);
  const bytes = Number(parsed.format?.size);
  if (
    !video ||
    !Number.isInteger(video.width) || video.width <= 0 || video.width > 8192 ||
    !Number.isInteger(video.height) || video.height <= 0 || video.height > 8192 ||
    !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 12 * 60 * 60 * 1000
  ) {
    throw renderError("invalid_source");
  }
  return {
    durationMs,
    bytes: Number.isFinite(bytes) ? bytes : 0,
    width: video.width,
    height: video.height,
    videoCodec: normalizeVideoCodec(video.codec_name),
    audioCodec: audio?.codec_name === "aac" ? "aac" : audio?.codec_name ?? null,
    hasAudio: Boolean(audio),
  };
}

export async function renderProxy({ input, output, segment, source }) {
  if (source.durationMs + 250 < segment.proxySourceEndMs) {
    throw renderError("invalid_source");
  }
  const durationMs = segment.proxySourceEndMs - segment.proxySourceStartMs;
  const args = [
    "-hide_banner",
    "-nostdin",
    "-loglevel", "warning",
    "-ss", seconds(segment.proxySourceStartMs),
    "-i", input,
    "-t", seconds(durationMs),
    "-map", "0:v:0",
  ];
  if (source.hasAudio) args.push("-map", "0:a:0");
  args.push(
    "-vf", "scale=1280:1280:force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "25",
    "-pix_fmt", "yuv420p"
  );
  if (source.hasAudio) {
    args.push("-c:a", "aac", "-b:a", "128k", "-ac", "2");
  }
  args.push(
    "-movflags", "+faststart",
    "-max_muxing_queue_size", "2048",
    "-y",
    output
  );
  await run("ffmpeg", args, "render_failed");
}

export function renderError(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

async function run(command, args, errorCode) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    process.stdout.setEncoding("utf8");
    process.stderr.setEncoding("utf8");
    process.stdout.on("data", (chunk) => {
      if (stdout.length < 1_000_000) stdout += chunk;
    });
    process.stderr.on("data", (chunk) => {
      if (stderr.length < 8_000) stderr += chunk;
    });
    process.on("error", (error) => reject(renderError(errorCode, error)));
    process.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(renderError(errorCode));
    });
  });
}

function validRange(startMs, endMs) {
  return Number.isInteger(startMs) && startMs >= 0 &&
    Number.isInteger(endMs) && endMs > startMs;
}

function httpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function seconds(valueMs) {
  return (valueMs / 1000).toFixed(3);
}

function normalizeVideoCodec(value) {
  return value === "avc1" ? "h264" : value;
}
