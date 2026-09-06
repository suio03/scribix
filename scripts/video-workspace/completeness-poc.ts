import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  OPENAI_CANDIDATE_MODEL,
  OPENAI_CANDIDATE_REASONING_EFFORT,
  generateCandidatesWithOpenAI,
  reviewCandidatesWithOpenAI,
} from "../../lib/openai-candidates";
import {
  alignAndValidateCandidateSet,
  buildCandidateAnalysisInput,
  candidateLimitForSourceDuration,
  type TranscriptWordBoundary,
} from "../../lib/video-workspace/candidate-generation";
// The container renderer is plain JavaScript and intentionally has no app-facing types.
// @ts-expect-error -- POC script imports the runtime media probe directly.
import { probeMedia } from "../../containers/video-preview/preview-render.mjs";

type LocalTranscript = {
  source?: { durationMs?: number; fingerprint?: string };
  text?: string;
  words?: Array<{ text: string; start: number; end: number; speaker?: string }>;
  utterances?: Array<{ text: string; start: number; end: number; speaker?: string | null }>;
  sentences?: Array<{ text: string; start: number; end: number; speaker?: string | null }>;
  paragraphs?: Array<{ text: string; start: number; end: number; speaker?: string | null }>;
};

const args = parseArgs(process.argv.slice(2));
const sourcePath = resolve(requiredArg(args, "source"));
const transcriptPath = resolve(requiredArg(args, "transcript"));
const outputDirectory = resolve(requiredArg(args, "output-dir"));
const source = await probeMedia(sourcePath);
const transcript = JSON.parse(await readFile(transcriptPath, "utf8")) as LocalTranscript;
const transcriptSource = transcript.source;
if (
  !transcriptSource ||
  transcriptSource.durationMs !== source.durationMs ||
  !transcriptSource.fingerprint ||
  !transcript.words?.length
) {
  throw new Error("transcript_source_mismatch");
}

await mkdir(outputDirectory, { recursive: true });
const analysisInput = buildCandidateAnalysisInput(transcript, source.durationMs);
const maxCandidates = candidateLimitForSourceDuration(source.durationMs);
const cacheKey = `scribix-completeness-${transcriptSource.fingerprint}`;
const generationStartedAt = Date.now();
const generated = await generateCandidatesWithOpenAI(analysisInput, {
  requestId: `completeness-poc-generate-${randomUUID()}`,
  promptCacheKey: cacheKey,
  maxCandidates,
});
const generationLatencyMs = Date.now() - generationStartedAt;

const reviewStartedAt = Date.now();
const reviewed = await reviewCandidatesWithOpenAI(
  analysisInput,
  generated.candidates,
  {
    requestId: `completeness-poc-review-${randomUUID()}`,
    promptCacheKey: cacheKey,
  }
);
const reviewLatencyMs = Date.now() - reviewStartedAt;
const candidates = alignAndValidateCandidateSet(
  reviewed.candidates,
  analysisInput.words,
  source.durationMs,
  () => `complete-${randomUUID()}`
);

const candidateOutput = {
  schemaVersion: 1,
  label: "terra-completeness-reviewed",
  model: OPENAI_CANDIDATE_MODEL,
  reasoningEffort: OPENAI_CANDIDATE_REASONING_EFFORT,
  generation: {
    responseId: generated.responseId,
    serviceTier: generated.serviceTier,
    latencyMs: generationLatencyMs,
    usage: generated.usage,
    candidates: generated.candidates,
  },
  review: {
    responseId: reviewed.responseId,
    serviceTier: reviewed.serviceTier,
    latencyMs: reviewLatencyMs,
    usage: reviewed.usage,
    decisions: reviewed.reviews,
  },
  candidates,
};
await writeJson(
  `${outputDirectory}/candidates-terra-complete.json`,
  candidateOutput
);

const report = {
  schemaVersion: 1,
  model: OPENAI_CANDIDATE_MODEL,
  reasoningEffort: OPENAI_CANDIDATE_REASONING_EFFORT,
  transcript: {
    inputChars: analysisInput.text.length,
    inputTruncated: analysisInput.truncated,
    wordCount: analysisInput.words.length,
  },
  policy: {
    completenessHardGate: true,
    spokenContentMustStandAlone: true,
    titlesMayRepairContext: false,
    minimumDurationMs: 15_000,
    maximumDurationMs: 45_000,
    maximumSegments: 3,
    chronologicalSameContextOnly: true,
    fillQuota: false,
  },
  generation: {
    latencyMs: generationLatencyMs,
    usage: generated.usage,
    candidateCount: generated.candidates.candidates.length,
    candidates: generated.candidates.candidates.map((candidate) => ({
      ...candidate,
      durationMs: durationOf(candidate.segments),
      transcriptExcerpt: excerptForCandidate(candidate.segments, analysisInput.words),
    })),
  },
  review: {
    latencyMs: reviewLatencyMs,
    usage: reviewed.usage,
    acceptedCount: reviewed.reviews.filter((review) => review.verdict === "accept").length,
    adjustedCount: reviewed.reviews.filter((review) => review.verdict === "adjust").length,
    rejectedCount: reviewed.reviews.filter((review) => review.verdict === "reject").length,
    decisions: reviewed.reviews,
  },
  final: {
    candidateCount: candidates.candidates.length,
    candidates: candidates.candidates.map((candidate) => ({
      ...candidate,
      durationMs: durationOf(candidate.segments),
      transcriptExcerpt: excerptForCandidate(candidate.segments, analysisInput.words),
    })),
  },
};
await writeJson(`${outputDirectory}/completeness-report.json`, report);
console.log(JSON.stringify({
  event: "completeness_poc_completed",
  generatedCount: report.generation.candidateCount,
  acceptedCount: report.review.acceptedCount,
  adjustedCount: report.review.adjustedCount,
  rejectedCount: report.review.rejectedCount,
  finalCandidateCount: report.final.candidateCount,
  generationLatencyMs,
  reviewLatencyMs,
  generationUsage: generated.usage,
  reviewUsage: reviewed.usage,
}));

function excerptForCandidate(
  segments: Array<{ startMs: number; endMs: number }>,
  words: TranscriptWordBoundary[]
): string {
  return segments.map((segment) => words
    .filter((word) => word.endMs > segment.startMs && word.startMs < segment.endMs)
    .map((word) => word.text)
    .join(" ")
  ).join(" […] ").slice(0, 4_000);
}

function durationOf(segments: Array<{ startMs: number; endMs: number }>): number {
  return segments.reduce(
    (total, segment) => total + segment.endMs - segment.startMs,
    0
  );
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(values: string[]): Map<string, string> {
  const parsed = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error("invalid_arguments");
    parsed.set(key.slice(2), value);
  }
  return parsed;
}

function requiredArg(values: Map<string, string>, name: string): string {
  const value = values.get(name);
  if (!value) throw new Error(`${name}_missing`);
  return value;
}
