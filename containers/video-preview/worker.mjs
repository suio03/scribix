import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadAsset, renderFinal, validateFinalLease } from "./final-render.mjs";
import {
  probeMedia,
  renderError,
  renderProxy,
  validateLease as validatePreviewLease,
} from "./preview-render.mjs";

const jobId = requiredEnv("SCRIBIX_JOB_ID");
const jobToken = requiredEnv("SCRIBIX_JOB_TOKEN");
const internalBaseUrl = requiredEnv("SCRIBIX_INTERNAL_URL").replace(/\/$/, "");
const jobUrl = `${internalBaseUrl}/api/internal/video-jobs/${encodeURIComponent(jobId)}`;
const authorization = `Bearer ${jobToken}`;
let workingDirectory;

try {
  console.log(JSON.stringify({ event: "video_render_started", jobId }));
  const rawLease = await requestJson(`${jobUrl}/lease`, {
    method: "POST",
    headers: { authorization },
  });
  workingDirectory = await mkdtemp(join(tmpdir(), "scribix-render-"));
  if (rawLease.kind === "final") {
    await runFinal(validateFinalLease(rawLease));
  } else {
    await runPreview(validatePreviewLease(rawLease));
  }
} catch (error) {
  const errorCode = stableErrorCode(error);
  console.error(JSON.stringify({ event: "video_render_failed", jobId, errorCode }));
  try {
    await complete({ status: "failed", errorCode });
  } catch {
    console.error(JSON.stringify({ event: "video_render_failure_callback_failed", jobId }));
  }
  process.exitCode = 1;
} finally {
  if (workingDirectory) await rm(workingDirectory, { recursive: true, force: true });
}

async function runPreview(lease) {
  const outputPath = join(workingDirectory, "preview.mp4");
  const source = await probeMedia(lease.sourceUrl);
  await renderProxy({ input: lease.sourceUrl, output: outputPath, segment: lease.segment, source });
  const output = await probeMedia(outputPath);
  await markUploading();
  const file = await readFile(outputPath);
  await upload(lease.outputUrl, "video/mp4", file);
  await complete({
    status: "completed",
    output: {
      bytes: file.byteLength,
      durationMs: output.durationMs,
      width: output.width,
      height: output.height,
      videoCodec: output.videoCodec,
      audioCodec: output.hasAudio ? output.audioCodec : null,
    },
  });
  console.log(JSON.stringify({ event: "video_preview_completed", jobId, bytes: file.byteLength, durationMs: output.durationMs }));
}

async function runFinal(lease) {
  const [logoPath, fontPath] = await Promise.all([
    downloadAsset(lease.logoUrl, join(workingDirectory, "logo-asset")),
    downloadAsset(lease.fontUrl, join(workingDirectory, "font-asset")),
  ]);
  const rendered = await renderFinal({ lease, workingDirectory, logoPath, fontPath });
  await markUploading();
  const [video, cover] = await Promise.all([
    readFile(rendered.outputPath),
    readFile(rendered.coverPath),
  ]);
  await Promise.all([
    upload(lease.outputVideoUrl, "video/mp4", video),
    upload(lease.outputCoverUrl, "image/jpeg", cover),
  ]);
  await complete({
    status: "completed",
    output: {
      video: {
        bytes: video.byteLength,
        durationMs: rendered.output.durationMs,
        width: rendered.output.width,
        height: rendered.output.height,
        videoCodec: rendered.output.videoCodec,
        audioCodec: rendered.output.audioCodec,
      },
      cover: {
        bytes: cover.byteLength,
        width: 1080,
        height: 1920,
        mimeType: "image/jpeg",
      },
    },
  });
  console.log(JSON.stringify({ event: "video_final_completed", jobId, bytes: video.byteLength, durationMs: rendered.output.durationMs }));
}

async function markUploading() {
  await requestJson(`${jobUrl}/progress`, {
    method: "POST",
    headers: { authorization },
  });
}

async function complete(body) {
  await requestJson(`${jobUrl}/result`, {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function upload(url, contentType, body) {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": contentType },
    body,
  });
  if (!response.ok) throw renderError("upload_failed");
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw renderError(response.status >= 500 ? "provider_unavailable" : "invalid_render_spec");
  }
  return response.json();
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name.toLowerCase()}_missing`);
  return value;
}

function stableErrorCode(error) {
  const code = error?.code;
  return [
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
  ].includes(code) ? code : "render_failed";
}
