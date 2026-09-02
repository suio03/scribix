import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { probeMedia } from "../../containers/video-preview/preview-render.mjs";
import { renderFinal } from "../../containers/video-preview/final-render.mjs";
import {
  estimatePocContainerCost,
  pocBenchmarkCases,
  pocRenderLease,
} from "../../containers/video-preview/poc-contract.mjs";

const args = parseArgs(process.argv.slice(2));
const sourcePath = resolve(requiredArg(args, "source"));
const outputDirectory = resolve(requiredArg(args, "output-dir"));
const source = await probeMedia(sourcePath);
const cases = pocBenchmarkCases(source.durationMs);
const results = [];

await mkdir(outputDirectory, { recursive: true });

for (const benchmarkCase of cases) {
  const caseDirectory = join(outputDirectory, benchmarkCase.id);
  await mkdir(caseDirectory, { recursive: true });
  const lease = pocRenderLease(benchmarkCase);
  const startedAt = performance.now();
  const rendered = await renderFinal({
    lease,
    workingDirectory: caseDirectory,
    sourceInput: sourcePath,
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const [video, cover] = await Promise.all([
    readFile(rendered.outputPath),
    readFile(rendered.coverPath),
  ]);
  const result = {
    id: benchmarkCase.id,
    segmentCount: benchmarkCase.segments.length,
    outputDurationMs: benchmarkCase.segments.reduce(
      (total, segment) => total + segment.sourceEndMs - segment.sourceStartMs,
      0
    ),
    elapsedMs,
    realtimeFactor: round(elapsedMs / rendered.output.durationMs),
    videoBytes: video.byteLength,
    coverBytes: cover.byteLength,
    output: {
      durationMs: rendered.output.durationMs,
      width: rendered.output.width,
      height: rendered.output.height,
      videoCodec: rendered.output.videoCodec,
      audioCodec: rendered.output.audioCodec,
    },
    estimatedContainerCostUsd: estimatePocContainerCost(elapsedMs),
  };
  results.push(result);
  console.log(JSON.stringify({ event: "cloudflare_container_poc_case_completed", ...result }));
}

const report = {
  schemaVersion: 1,
  profile: {
    vcpu: 1,
    memoryGiB: 3,
    diskGB: 6,
    idleAfterRenderSeconds: 30,
  },
  source: {
    durationMs: source.durationMs,
    bytes: source.bytes,
    width: source.width,
    height: source.height,
    videoCodec: source.videoCodec,
    audioCodec: source.audioCodec,
    hasAudio: source.hasAudio,
  },
  results,
  totals: {
    elapsedMs: results.reduce((total, result) => total + result.elapsedMs, 0),
    estimatedContainerCostUsd: round(
      results.reduce((total, result) => total + result.estimatedContainerCostUsd, 0),
      6
    ),
  },
  privacy: {
    sourceNameRecorded: false,
    contentRecorded: false,
    captionsRecorded: false,
  },
};

await writeFile(join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  event: "cloudflare_container_poc_completed",
  caseCount: results.length,
  elapsedMs: report.totals.elapsedMs,
  estimatedContainerCostUsd: report.totals.estimatedContainerCostUsd,
}));

function parseArgs(values) {
  const parsed = new Map();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error("invalid_arguments");
    parsed.set(key.slice(2), value);
  }
  return parsed;
}

function requiredArg(values, name) {
  const value = values.get(name);
  if (!value) throw new Error(`${name}_missing`);
  return value;
}

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
