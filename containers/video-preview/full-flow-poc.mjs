import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { analyzeReframe, renderReframedPoc } from "./poc-reframe.mjs";

const args = parseArgs(process.argv.slice(2));
const sourcePath = resolve(requiredArg(args, "source"));
const transcriptPath = resolve(requiredArg(args, "transcript"));
const candidatesPath = resolve(requiredArg(args, "candidates"));
const outputDirectory = resolve(requiredArg(args, "output-dir"));
const transcript = JSON.parse(await readFile(transcriptPath, "utf8"));
const candidateRun = JSON.parse(await readFile(candidatesPath, "utf8"));
const candidates = candidateRun?.candidates?.candidates;

if (!Array.isArray(transcript.words) || !Array.isArray(candidates)) {
  throw new Error("invalid_full_flow_inputs");
}

await mkdir(outputDirectory, { recursive: true });
const results = [];
for (const [candidateIndex, candidate] of candidates.entries()) {
  const candidateDirectory = join(
    outputDirectory,
    `${String(candidateIndex + 1).padStart(2, "0")}-${safeSlug(candidate.theme)}`
  );
  await mkdir(candidateDirectory, { recursive: true });
  const segments = candidate.segments.map((segment, segmentIndex) => ({
    id: `candidate-${candidateIndex + 1}-segment-${segmentIndex + 1}`,
    order: segmentIndex,
    sourceStartMs: segment.startMs,
    sourceEndMs: segment.endMs,
  }));
  const presentation = buildPresentation(segments, transcript.words);
  const startedAt = performance.now();
  const analysisStartedAt = performance.now();
  const plan = await analyzeReframe({
    sourceInput: sourcePath,
    segments,
    workingDirectory: candidateDirectory,
  });
  const analysisMs = Math.round(performance.now() - analysisStartedAt);
  const renderStartedAt = performance.now();
  const rendered = await renderReframedPoc({
    sourceInput: sourcePath,
    segments,
    plan,
    workingDirectory: candidateDirectory,
    presentation,
  });
  const renderMs = Math.round(performance.now() - renderStartedAt);
  const [video, cover] = await Promise.all([
    stat(rendered.outputPath),
    stat(rendered.coverPath),
  ]);
  const result = {
    rank: candidateIndex + 1,
    theme: candidate.theme,
    hook: candidate.hook,
    reason: candidate.reason,
    score: candidate.score,
    segments: candidate.segments,
    durationMs: rendered.output.durationMs,
    analysisMs,
    renderMs,
    totalMs: Math.round(performance.now() - startedAt),
    videoBytes: video.size,
    coverBytes: cover.size,
    outputPath: rendered.outputPath,
    coverPath: rendered.coverPath,
    reframe: plan.segments.map((segment) => ({
      segmentId: segment.segmentId,
      mode: segment.mode,
      confidence: segment.confidence,
      reasons: segment.reasons,
      keyframeCount: segment.keyframes.length,
    })),
    captionCueCount: presentation.renderSpec.captions.cues.length,
  };
  results.push(result);
  await writeFile(
    join(candidateDirectory, "result.json"),
    `${JSON.stringify(result, null, 2)}\n`
  );
  console.log(JSON.stringify({ event: "full_flow_candidate_rendered", ...result }));
}

const report = {
  schemaVersion: 1,
  model: candidateRun.model,
  reasoningEffort: candidateRun.reasoningEffort,
  candidateCount: candidates.length,
  results,
  totals: {
    outputDurationMs: results.reduce((total, result) => total + result.durationMs, 0),
    analysisMs: results.reduce((total, result) => total + result.analysisMs, 0),
    renderMs: results.reduce((total, result) => total + result.renderMs, 0),
    totalMs: results.reduce((total, result) => total + result.totalMs, 0),
  },
  presentation: {
    width: 1080,
    height: 1920,
    captions: "karaoke-v1",
    audioNormalized: true,
    smartReframe: true,
  },
};
await writeFile(
  join(outputDirectory, "render-report.json"),
  `${JSON.stringify(report, null, 2)}\n`
);
console.log(JSON.stringify({ event: "full_flow_render_completed", ...report.totals }));

function buildPresentation(segments, transcriptWords) {
  const cues = [];
  for (const segment of segments) {
    const words = transcriptWords
      .filter((word) => word.end > segment.sourceStartMs && word.start < segment.sourceEndMs)
      .map((word) => ({
        text: word.text,
        sourceStartMs: Math.max(segment.sourceStartMs, Math.round(word.start)),
        sourceEndMs: Math.min(segment.sourceEndMs, Math.round(word.end)),
      }))
      .filter((word) => word.sourceEndMs > word.sourceStartMs);
    let group = [];
    for (const word of words) {
      const previous = group.at(-1);
      const charCount = group.reduce((total, item) => total + [...item.text].length + 1, 0);
      const pauseMs = previous ? word.sourceStartMs - previous.sourceEndMs : 0;
      if (group.length > 0 && (group.length >= 7 || charCount + [...word.text].length > 42 || pauseMs > 650)) {
        cues.push(captionCue(segment.id, group, cues.length));
        group = [];
      }
      group.push(word);
    }
    if (group.length > 0) cues.push(captionCue(segment.id, group, cues.length));
  }
  return {
    edl: { schemaVersion: 1, segments },
    renderSpec: {
      schemaVersion: 1,
      outputPresetId: "vertical-1080p-v1",
      canvas: { width: 1080, height: 1920, fps: 30, backgroundColor: "#0b0f14" },
      segments: {},
      captions: {
        enabled: true,
        templateId: "karaoke-v1",
        fontAssetId: null,
        textColor: "#ffffff",
        highlightColor: "#a3e635",
        positionY: 0.76,
        maxCharsPerLine: 22,
        maxLines: 2,
        cues,
      },
      brand: {
        templateId: "signature-v1",
        logoAssetId: null,
        accentColor: "#a3e635",
        logoPosition: "top-right",
        logoScale: 0.12,
      },
      audio: { gainDb: 0, normalize: true, fadeInMs: 100, fadeOutMs: 180 },
      coverTimelineMs: 1_200,
    },
  };
}

function captionCue(segmentId, words, index) {
  return {
    id: `cue-${index + 1}`,
    segmentId,
    sourceStartMs: words[0].sourceStartMs,
    sourceEndMs: words.at(-1).sourceEndMs,
    words,
  };
}

function safeSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 54) || "candidate";
}

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
