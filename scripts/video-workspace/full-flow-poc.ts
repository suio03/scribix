import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import {
  generateCandidatesWithOpenAI,
  type OpenAICandidateModel,
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

const AAI_BASE_URL = "https://api.assemblyai.com/v2";
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 45 * 60_000;

type AaiWord = {
  text: string;
  start: number;
  end: number;
  speaker?: string;
};

type AaiSegment = {
  text: string;
  start: number;
  end: number;
  speaker?: string | null;
};

type AaiTranscript = {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  audio_duration?: number;
  language_code?: string;
  speech_model?: string;
  error?: string;
  text?: string;
  words?: AaiWord[];
  utterances?: AaiSegment[];
};

type LocalTranscript = {
  schemaVersion: number;
  source: {
    durationMs: number;
    bytes: number;
    width: number;
    height: number;
    videoCodec: string;
    audioCodec: string | null;
    nameRecorded: boolean;
    fingerprint: string;
  };
  provider: {
    name: string;
    transcriptId: string;
    languageCode: string | null;
    speechModel: string | null;
    audioDurationSeconds: number | null;
  };
  text: string;
  words: AaiWord[];
  utterances: AaiSegment[];
  sentences: AaiSegment[];
  paragraphs: AaiSegment[];
};

const args = parseArgs(process.argv.slice(2));
const sourcePath = resolve(requiredArg(args, "source"));
const outputDirectory = resolve(requiredArg(args, "output-dir"));
const reusableTranscriptPath = args.get("transcript");
const source = await probeMedia(sourcePath);
const sourceStat = await stat(sourcePath);
const candidateLimit = candidateLimitForSourceDuration(source.durationMs);
const sourceFingerprint = createHash("sha256")
  .update(`${sourceStat.size}:${source.durationMs}:${basename(sourcePath)}`)
  .digest("hex")
  .slice(0, 16);

await mkdir(outputDirectory, { recursive: true });
const audioPath = join(outputDirectory, ".transcription-audio.mp3");
let transcriptId: string | null = null;

try {
  let localTranscript: LocalTranscript;
  if (reusableTranscriptPath) {
    localTranscript = JSON.parse(
      await readFile(resolve(reusableTranscriptPath), "utf8")
    ) as LocalTranscript;
    if (
      localTranscript.source.fingerprint !== sourceFingerprint ||
      localTranscript.source.durationMs !== source.durationMs ||
      localTranscript.words.length === 0
    ) {
      throw new Error("Reusable transcript does not match the source");
    }
    console.log(JSON.stringify({
      event: "full_flow_transcript_reused",
      wordCount: localTranscript.words.length,
      sentenceCount: localTranscript.sentences.length,
      languageCode: localTranscript.provider.languageCode,
    }));
  } else {
    console.log(JSON.stringify({
      event: "full_flow_audio_extract_started",
      sourceDurationMs: source.durationMs,
      sourceBytes: source.bytes,
    }));
    const audioStartedAt = Date.now();
    await run("ffmpeg", [
      "-hide_banner",
      "-nostdin",
      "-loglevel", "warning",
      "-i", sourcePath,
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-c:a", "libmp3lame",
      "-b:a", "64k",
      "-y",
      audioPath,
    ], 20 * 60_000);
    const audioStat = await stat(audioPath);
    console.log(JSON.stringify({
      event: "full_flow_audio_extract_completed",
      audioBytes: audioStat.size,
      latencyMs: Date.now() - audioStartedAt,
    }));

    const uploadUrl = await uploadAudio(audioPath);
    const submitted = await submitTranscript(uploadUrl);
    transcriptId = submitted.id;
    console.log(JSON.stringify({
      event: "full_flow_transcript_submitted",
      transcriptId,
    }));

    const transcript = await waitForTranscript(transcriptId);
    const [sentences, paragraphs] = await Promise.all([
      fetchSegments(transcriptId, "sentences"),
      fetchSegments(transcriptId, "paragraphs"),
    ]);
    localTranscript = {
      schemaVersion: 1,
      source: {
        durationMs: source.durationMs,
        bytes: source.bytes,
        width: source.width,
        height: source.height,
        videoCodec: source.videoCodec,
        audioCodec: source.audioCodec,
        nameRecorded: false,
        fingerprint: sourceFingerprint,
      },
      provider: {
        name: "assemblyai",
        transcriptId,
        languageCode: transcript.language_code ?? null,
        speechModel: transcript.speech_model ?? null,
        audioDurationSeconds: transcript.audio_duration ?? null,
      },
      text: transcript.text ?? "",
      words: transcript.words ?? [],
      utterances: transcript.utterances ?? [],
      sentences,
      paragraphs,
    };
    await writeJson(join(outputDirectory, "transcript.json"), localTranscript);
    console.log(JSON.stringify({
      event: "full_flow_transcript_saved",
      wordCount: localTranscript.words.length,
      sentenceCount: sentences.length,
      languageCode: localTranscript.provider.languageCode,
    }));
  }

  const analysisInput = buildCandidateAnalysisInput(localTranscript, source.durationMs);
  console.log(JSON.stringify({
    event: "full_flow_candidate_ab_started",
    inputChars: analysisInput.text.length,
    inputTruncated: analysisInput.truncated,
    candidateLimit,
    models: ["gpt-5.6-luna", "gpt-5.6-terra"],
    reasoningEffort: "medium",
  }));

  const modelRuns = await Promise.all([
    runCandidateModel("gpt-5.6-luna", "luna", analysisInput.text, analysisInput.words),
    runCandidateModel("gpt-5.6-terra", "terra", analysisInput.text, analysisInput.words),
  ]);
  for (const runResult of modelRuns) {
    await writeJson(
      join(outputDirectory, `candidates-${runResult.label}.json`),
      runResult
    );
  }

  const report = {
    schemaVersion: 1,
    source: localTranscript.source,
    transcript: {
      languageCode: localTranscript.provider.languageCode,
      wordCount: localTranscript.words.length,
      sentenceCount: localTranscript.sentences.length,
      inputChars: analysisInput.text.length,
      inputTruncated: analysisInput.truncated,
    },
    policy: {
      candidateLimit,
      minimumDurationMs: 15_000,
      maximumDurationMs: 45_000,
      maximumSegments: 3,
      fillQuota: false,
    },
    comparisons: modelRuns.map((runResult) => ({
      label: runResult.label,
      model: runResult.model,
      reasoningEffort: runResult.reasoningEffort,
      latencyMs: runResult.latencyMs,
      usage: runResult.usage,
      providerCandidateCount: runResult.providerCandidates.candidates.length,
      validCandidateCount: runResult.candidates.candidates.length,
      candidates: runResult.candidates.candidates.map((candidate) => ({
        id: candidate.id,
        theme: candidate.theme,
        hook: candidate.hook,
        reason: candidate.reason,
        score: candidate.score,
        durationMs: candidate.segments.reduce(
          (total, segment) => total + segment.endMs - segment.startMs,
          0
        ),
        segments: candidate.segments,
        transcriptExcerpt: excerptForCandidate(candidate.segments, analysisInput.words),
      })),
    })),
    privacy: {
      fullVideoUploaded: false,
      audioUploadedToAssemblyAi: !reusableTranscriptPath,
      transcriptSentToOpenAi: true,
      openAiStore: false,
      reusedLocalTranscript: Boolean(reusableTranscriptPath),
      assemblyAiTranscriptDeletedInThisRun: !reusableTranscriptPath,
    },
  };
  await writeJson(join(outputDirectory, "analysis-report.json"), report);
  console.log(JSON.stringify({
    event: "full_flow_candidate_ab_completed",
    comparisons: report.comparisons.map((comparison) => ({
      label: comparison.label,
      validCandidateCount: comparison.validCandidateCount,
      latencyMs: comparison.latencyMs,
      usage: comparison.usage,
    })),
  }));
} finally {
  await rm(audioPath, { force: true });
  if (transcriptId) {
    try {
      await deleteTranscript(transcriptId);
      console.log(JSON.stringify({
        event: "full_flow_external_transcript_deleted",
        transcriptId,
      }));
    } catch (error) {
      console.error(JSON.stringify({
        event: "full_flow_external_transcript_delete_failed",
        transcriptId,
        message: error instanceof Error ? error.message : "unknown_error",
      }));
    }
  }
}

async function runCandidateModel(
  model: OpenAICandidateModel,
  label: "luna" | "terra",
  input: string,
  words: TranscriptWordBoundary[]
) {
  const startedAt = Date.now();
  const providerResult = await generateCandidatesWithOpenAI(input, {
    requestId: `full-flow-poc-${label}-${randomUUID()}`,
    promptCacheKey: `scribix-full-flow-${sourceFingerprint}`,
    maxCandidates: candidateLimit,
    model,
    reasoningEffort: "medium",
  });
  const candidates = alignAndValidateCandidateSet(
    providerResult.candidates,
    words,
    source.durationMs,
    () => `${label}-${randomUUID()}`
  );
  return {
    schemaVersion: 1,
    label,
    model,
    reasoningEffort: "medium" as const,
    latencyMs: Date.now() - startedAt,
    responseId: providerResult.responseId,
    serviceTier: providerResult.serviceTier,
    usage: providerResult.usage,
    providerCandidates: providerResult.candidates,
    candidates,
  };
}

async function uploadAudio(audioPath: string): Promise<string> {
  const startedAt = Date.now();
  const bytes = await readFile(audioPath);
  const response = await fetch(`${AAI_BASE_URL}/upload`, {
    method: "POST",
    headers: {
      authorization: assemblyAiKey(),
      "content-type": "application/octet-stream",
    },
    body: bytes,
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!response.ok) {
    throw new Error(`AssemblyAI upload failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  }
  const payload = await response.json() as { upload_url?: string };
  if (!payload.upload_url) throw new Error("AssemblyAI upload returned no URL");
  console.log(JSON.stringify({
    event: "full_flow_audio_uploaded",
    audioBytes: bytes.byteLength,
    latencyMs: Date.now() - startedAt,
  }));
  return payload.upload_url;
}

async function submitTranscript(audioUrl: string): Promise<AaiTranscript> {
  const response = await fetch(`${AAI_BASE_URL}/transcript`, {
    method: "POST",
    headers: {
      authorization: assemblyAiKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speech_models: ["universal-3-pro", "universal-2"],
      speaker_labels: true,
      language_detection: true,
      punctuate: true,
      format_text: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`AssemblyAI submit failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  }
  return response.json() as Promise<AaiTranscript>;
}

async function waitForTranscript(id: string): Promise<AaiTranscript> {
  const startedAt = Date.now();
  let previousStatus = "";
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const response = await fetch(`${AAI_BASE_URL}/transcript/${id}`, {
      headers: { authorization: assemblyAiKey() },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`AssemblyAI fetch failed: ${response.status}`);
    const transcript = await response.json() as AaiTranscript;
    if (transcript.status !== previousStatus) {
      previousStatus = transcript.status;
      console.log(JSON.stringify({
        event: "full_flow_transcript_status",
        transcriptId: id,
        status: transcript.status,
        elapsedMs: Date.now() - startedAt,
      }));
    }
    if (transcript.status === "completed") return transcript;
    if (transcript.status === "error") {
      throw new Error(`AssemblyAI transcription failed: ${transcript.error ?? "unknown_error"}`);
    }
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error("AssemblyAI transcription timed out");
}

async function fetchSegments(id: string, kind: "sentences" | "paragraphs"): Promise<AaiSegment[]> {
  const response = await fetch(`${AAI_BASE_URL}/transcript/${id}/${kind}`, {
    headers: { authorization: assemblyAiKey() },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`AssemblyAI ${kind} fetch failed: ${response.status}`);
  const payload = await response.json() as Record<string, AaiSegment[] | undefined>;
  return payload[kind] ?? [];
}

async function deleteTranscript(id: string): Promise<void> {
  const response = await fetch(`${AAI_BASE_URL}/transcript/${id}`, {
    method: "DELETE",
    headers: { authorization: assemblyAiKey() },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`AssemblyAI transcript delete failed: ${response.status}`);
  }
}

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

function assemblyAiKey(): string {
  const value = process.env.ASSEMBLYAI_API_KEY;
  if (!value) throw new Error("ASSEMBLYAI_API_KEY not set");
  return value;
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function run(command: string, commandArgs: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, commandArgs, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      rejectRun(new Error(`${command} timed out`));
    }, timeoutMs);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 16_000) stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectRun(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} failed: ${stderr.slice(0, 1_000)}`));
    });
  });
}
