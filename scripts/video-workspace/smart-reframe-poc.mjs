import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { probeMedia } from "../../containers/video-preview/preview-render.mjs";
import {
  analyzeReframe,
  renderReframedPoc,
} from "../../containers/video-preview/poc-reframe.mjs";
import {
  estimatePocContainerCost,
  pocBenchmarkCases,
} from "../../containers/video-preview/poc-contract.mjs";

const args = parseArgs(process.argv.slice(2));
const sourcePath = resolve(requiredArg(args, "source"));
const outputDirectory = resolve(requiredArg(args, "output-dir"));
const requestedCase = args.get("case");
const source = await probeMedia(sourcePath);
const cases = pocBenchmarkCases(source.durationMs)
  .filter((benchmarkCase) => !requestedCase || benchmarkCase.id === requestedCase);
if (cases.length === 0) throw new Error("invalid_case");

await mkdir(outputDirectory, { recursive: true });
const results = [];
for (const benchmarkCase of cases) {
  const caseDirectory = join(outputDirectory, benchmarkCase.id);
  await mkdir(caseDirectory, { recursive: true });
  const jobStartedAt = performance.now();
  const analysisStartedAt = performance.now();
  const plan = await analyzeReframe({
    sourceInput: sourcePath,
    segments: benchmarkCase.segments,
    workingDirectory: caseDirectory,
  });
  const analysisMs = Math.round(performance.now() - analysisStartedAt);
  const renderStartedAt = performance.now();
  const rendered = await renderReframedPoc({
    sourceInput: sourcePath,
    segments: benchmarkCase.segments,
    plan,
    workingDirectory: caseDirectory,
  });
  const renderMs = Math.round(performance.now() - renderStartedAt);
  const totalMs = Math.round(performance.now() - jobStartedAt);
  const [video, cover] = await Promise.all([
    stat(rendered.outputPath),
    stat(rendered.coverPath),
  ]);
  const result = {
    id: benchmarkCase.id,
    segmentCount: benchmarkCase.segments.length,
    analysisMs,
    renderMs,
    totalMs,
    realtimeFactor: round(renderMs / rendered.output.durationMs),
    estimatedContainerCostUsd: estimatePocContainerCost(totalMs),
    videoBytes: video.size,
    coverBytes: cover.size,
    output: rendered.output,
    reframe: plan.segments.map((segment) => ({
      segmentId: segment.segmentId,
      mode: segment.mode,
      confidence: segment.confidence,
      reasons: segment.reasons,
      keyframeCount: segment.keyframes.length,
      diagnostics: segment.diagnostics,
    })),
  };
  results.push(result);
  console.log(JSON.stringify({ event: "smart_reframe_poc_case_completed", ...result }));
}

const report = {
  schemaVersion: 1,
  profile: { vcpu: 1, memoryGiB: 3, diskGB: 6 },
  source: {
    durationMs: source.durationMs,
    bytes: source.bytes,
    width: source.width,
    height: source.height,
    videoCodec: source.videoCodec,
    audioCodec: source.audioCodec,
    hasAudio: source.hasAudio,
    nameRecorded: false,
  },
  results,
  totals: {
    analysisMs: results.reduce((total, result) => total + result.analysisMs, 0),
    renderMs: results.reduce((total, result) => total + result.renderMs, 0),
    totalMs: results.reduce((total, result) => total + result.totalMs, 0),
    estimatedContainerCostUsd: round(
      results.reduce((total, result) => total + result.estimatedContainerCostUsd, 0),
      6
    ),
  },
  privacy: {
    sourceNameRecorded: false,
    framesPersisted: false,
    faceCoordinatesPersisted: false,
  },
};
await writeFile(join(outputDirectory, "smart-reframe-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ event: "smart_reframe_poc_completed", ...report.totals }));

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
