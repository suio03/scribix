import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { pipeline } from "node:stream/promises";
import { performance } from "node:perf_hooks";
import { join } from "node:path";
import { probeMedia } from "./preview-render.mjs";
import { renderFinal } from "./final-render.mjs";
import { analyzeReframe, renderReframedPoc } from "./poc-reframe.mjs";
import {
  estimatePocContainerCost,
  pocBenchmarkCases,
  pocRenderLease,
} from "./poc-contract.mjs";

const port = 8080;
const root = "/tmp/scribix-video-poc";
const sourcePath = join(root, "source.mp4");
const renderDirectory = join(root, "render");
const maxSourceBytes = 2 * 1024 * 1024 * 1024;
let lastResult = null;
let lastOutputPath = null;
let lastCoverPath = null;
let rendering = false;

await mkdir(root, { recursive: true });

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://container");
    if (request.method === "GET" && ["/health", "/ping"].includes(url.pathname)) {
      return json(response, 200, { status: "ready" });
    }
    if (request.method === "PUT" && url.pathname === "/source") {
      if (rendering) return json(response, 409, { error: "render_in_progress" });
      await rm(root, { recursive: true, force: true });
      await mkdir(root, { recursive: true });
      await receiveSource(request, sourcePath);
      const source = await probeMedia(sourcePath);
      lastResult = null;
      lastOutputPath = null;
      lastCoverPath = null;
      return json(response, 200, {
        status: "source_ready",
        source: publicMedia(source),
      });
    }
    if (request.method === "POST" && url.pathname === "/render") {
      if (rendering) return json(response, 409, { error: "render_in_progress" });
      rendering = true;
      try {
        const body = await requestJson(request);
        const source = await probeMedia(sourcePath);
        const benchmarkCase = pocBenchmarkCases(source.durationMs)
          .find((candidate) => candidate.id === body.caseId);
        if (
          !benchmarkCase || !stableId(body.jobId) ||
          !["auto", "baseline"].includes(body.reframeMode)
        ) {
          return json(response, 400, { error: "invalid_render_request" });
        }
        await rm(renderDirectory, { recursive: true, force: true });
        await mkdir(renderDirectory, { recursive: true });
        const startedAt = performance.now();
        let analysisMs = 0;
        let reframe = [];
        let rendered;
        if (body.reframeMode === "auto") {
          const analysisStartedAt = performance.now();
          const plan = await analyzeReframe({
            sourceInput: sourcePath,
            segments: benchmarkCase.segments,
            workingDirectory: renderDirectory,
          });
          analysisMs = Math.round(performance.now() - analysisStartedAt);
          rendered = await renderReframedPoc({
            sourceInput: sourcePath,
            segments: benchmarkCase.segments,
            plan,
            workingDirectory: renderDirectory,
          });
          reframe = plan.segments.map((segment) => ({
            segmentId: segment.segmentId,
            mode: segment.mode,
            confidence: segment.confidence,
            reasons: segment.reasons,
            diagnostics: segment.diagnostics,
          }));
        } else {
          rendered = await renderFinal({
            lease: pocRenderLease(benchmarkCase, body.jobId),
            workingDirectory: renderDirectory,
            sourceInput: sourcePath,
          });
        }
        const elapsedMs = Math.round(performance.now() - startedAt);
        const renderMs = elapsedMs - analysisMs;
        const [video, cover] = await Promise.all([
          stat(rendered.outputPath),
          stat(rendered.coverPath),
        ]);
        lastResult = {
          jobId: body.jobId,
          caseId: benchmarkCase.id,
          reframeMode: body.reframeMode,
          segmentCount: benchmarkCase.segments.length,
          analysisMs,
          renderMs,
          elapsedMs,
          realtimeFactor: round(elapsedMs / rendered.output.durationMs),
          estimatedContainerCostUsd: estimatePocContainerCost(elapsedMs),
          videoBytes: video.size,
          coverBytes: cover.size,
          output: publicMedia(rendered.output),
          reframe,
        };
        lastOutputPath = rendered.outputPath;
        lastCoverPath = rendered.coverPath;
        console.log(JSON.stringify({ event: "poc_render_completed", ...lastResult }));
        return json(response, 200, lastResult);
      } finally {
        rendering = false;
      }
    }
    if (request.method === "GET" && url.pathname === "/output") {
      if (!lastOutputPath) return json(response, 404, { error: "output_not_ready" });
      return file(response, lastOutputPath, "video/mp4");
    }
    if (request.method === "GET" && url.pathname === "/cover") {
      if (!lastCoverPath) return json(response, 404, { error: "output_not_ready" });
      return file(response, lastCoverPath, "image/jpeg");
    }
    if (request.method === "GET" && url.pathname === "/report") {
      if (!lastResult) return json(response, 404, { error: "report_not_ready" });
      return json(response, 200, lastResult);
    }
    return json(response, 404, { error: "not_found" });
  } catch (error) {
    const code = stableError(error);
    console.error(JSON.stringify({ event: "poc_request_failed", errorCode: code }));
    return json(response, code === "source_too_large" ? 413 : 500, { error: code });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "poc_container_ready", port }));
});

async function receiveSource(request, path) {
  const declaredBytes = Number(request.headers["content-length"] ?? 0);
  if (declaredBytes > maxSourceBytes) throw codedError("source_too_large");
  let receivedBytes = 0;
  request.on("data", (chunk) => {
    receivedBytes += chunk.length;
    if (receivedBytes > maxSourceBytes) request.destroy(codedError("source_too_large"));
  });
  await pipeline(request, createWriteStream(path, { flags: "wx" }));
  if (receivedBytes === 0) throw codedError("invalid_source");
}

async function requestJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 8_192) throw codedError("invalid_render_request");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw codedError("invalid_render_request");
  }
}

async function file(response, path, contentType) {
  const details = await stat(path);
  response.writeHead(200, {
    "content-type": contentType,
    "content-length": String(details.size),
    "cache-control": "no-store",
  });
  await pipeline(createReadStream(path), response);
}

function json(response, status, body) {
  const value = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(value)),
    "cache-control": "no-store",
  });
  response.end(value);
}

function publicMedia(media) {
  return {
    durationMs: media.durationMs,
    bytes: media.bytes,
    width: media.width,
    height: media.height,
    videoCodec: media.videoCodec,
    audioCodec: media.audioCodec,
    hasAudio: media.hasAudio,
  };
}

function stableId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
}

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function stableError(error) {
  const value = String(error?.code ?? error?.message ?? "poc_failed");
  return value.startsWith("source_too_short") ? "source_too_short" : [
    "source_too_large",
    "invalid_source",
    "invalid_render_request",
    "render_failed",
    "reframe_analysis_failed",
    "reframe_render_failed",
    "invalid_reframe_plan",
  ].includes(value) ? value : "poc_failed";
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}
