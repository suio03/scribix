import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  probeMedia,
  renderError,
  renderProxy,
  validateLease,
} from "./preview-render.mjs";

const jobId = requiredEnv("SCRIBIX_JOB_ID");
const jobToken = requiredEnv("SCRIBIX_JOB_TOKEN");
const internalBaseUrl = requiredEnv("SCRIBIX_INTERNAL_URL").replace(/\/$/, "");
const jobUrl = `${internalBaseUrl}/api/internal/video-jobs/${encodeURIComponent(jobId)}`;
const authorization = `Bearer ${jobToken}`;
let workingDirectory;

try {
  console.log(JSON.stringify({ event: "video_preview_started", jobId }));
  const lease = validateLease(await requestJson(`${jobUrl}/lease`, {
    method: "POST",
    headers: { authorization },
  }));
  workingDirectory = await mkdtemp(join(tmpdir(), "scribix-preview-"));
  const outputPath = join(workingDirectory, "preview.mp4");
  const source = await probeMedia(lease.sourceUrl);
  await renderProxy({
    input: lease.sourceUrl,
    output: outputPath,
    segment: lease.segment,
    source,
  });
  const output = await probeMedia(outputPath);
  await requestJson(`${jobUrl}/progress`, {
    method: "POST",
    headers: { authorization },
  });
  const file = await readFile(outputPath);
  const upload = await fetch(lease.outputUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4" },
    body: file,
  });
  if (!upload.ok) throw renderError("upload_failed");
  await requestJson(`${jobUrl}/result`, {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify({
      status: "completed",
      output: {
        bytes: file.byteLength,
        durationMs: output.durationMs,
        width: output.width,
        height: output.height,
        videoCodec: output.videoCodec,
        audioCodec: output.hasAudio ? output.audioCodec : null,
      },
    }),
  });
  console.log(JSON.stringify({
    event: "video_preview_completed",
    jobId,
    bytes: file.byteLength,
    durationMs: output.durationMs,
  }));
} catch (error) {
  const errorCode = stableErrorCode(error);
  console.error(JSON.stringify({ event: "video_preview_failed", jobId, errorCode }));
  try {
    await requestJson(`${jobUrl}/result`, {
      method: "POST",
      headers: { authorization, "content-type": "application/json" },
      body: JSON.stringify({ status: "failed", errorCode }),
    });
  } catch {
    console.error(JSON.stringify({ event: "video_preview_failure_callback_failed", jobId }));
  }
  process.exitCode = 1;
} finally {
  if (workingDirectory) await rm(workingDirectory, { recursive: true, force: true });
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw renderError(response.status >= 500 ? "provider_unavailable" : "invalid_render_spec");
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
