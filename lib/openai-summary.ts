import type { AaiSegment, AaiTranscript } from "@/lib/aai";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const OPENAI_SUMMARY_MODEL = "gpt-5-nano";
const SUMMARY_MAX_OUTPUT_TOKENS = 2000;
const SUMMARY_INPUT_CHAR_LIMIT = 1_000_000;

type OpenAIResponse = {
  id?: string;
  status?: string;
  incomplete_details?: {
    reason?: string;
  } | null;
  output_text?: string;
  output?: Array<{
    type?: string;
    status?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    output_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type SummarizeOptions = {
  requestId?: string;
};

export class OpenAISummaryError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: string
  ) {
    super(message);
    this.name = "OpenAISummaryError";
  }
}

export async function summarizeTranscriptWithOpenAI(
  transcript: AaiTranscript,
  options: SummarizeOptions = {}
): Promise<string> {
  const input = transcriptToSummaryInput(transcript);
  if (!input.trim()) throw new OpenAISummaryError("Transcript text is empty");

  logSummary(options.requestId, "request", {
    model: OPENAI_SUMMARY_MODEL,
    inputChars: input.length,
    maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
    reasoningEffort: "minimal",
    verbosity: "low",
  });

  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${openAiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_SUMMARY_MODEL,
      instructions: [
        "You summarize transcripts for busy professionals.",
        "Use this exact structure:",
        "Overview: one concise paragraph.",
        "Key points: 3-6 bullets.",
        "Action items: bullets only if concrete action items are mentioned.",
        "Keep the summary factual. Do not invent names, decisions, or tasks.",
      ].join("\n"),
      input,
      max_output_tokens: SUMMARY_MAX_OUTPUT_TOKENS,
      reasoning: { effort: "minimal" },
      text: { verbosity: "low" },
    }),
  });

  if (!res.ok) {
    const details = await res.text();
    logSummary(options.requestId, "http error", {
      status: res.status,
      details: details.slice(0, 500),
    });
    throw new OpenAISummaryError(
      "OpenAI summary failed",
      res.status,
      details
    );
  }

  const json = (await res.json()) as OpenAIResponse;
  logSummary(options.requestId, "response", summarizeOpenAIResponse(json));

  if (json.error?.message) {
    throw new OpenAISummaryError(
      "OpenAI summary response error",
      undefined,
      `${json.error.code ? `${json.error.code}: ` : ""}${json.error.message}`
    );
  }
  if (json.incomplete_details?.reason) {
    throw new OpenAISummaryError(
      "OpenAI summary response incomplete",
      undefined,
      json.incomplete_details.reason
    );
  }

  const summary = extractResponseText(json).trim();
  if (!summary) {
    throw new OpenAISummaryError(
      "OpenAI summary response was empty",
      undefined,
      JSON.stringify(summarizeOpenAIResponse(json))
    );
  }
  return summary;
}

function transcriptToSummaryInput(transcript: AaiTranscript): string {
  return limitSummaryInput(transcriptToOpenAIInput(transcript));
}

export function transcriptToOpenAIInput(transcript: AaiTranscript): string {
  const segments =
    transcript.utterances?.length
      ? transcript.utterances
      : transcript.paragraphs?.length
        ? transcript.paragraphs
        : transcript.sentences?.length
          ? transcript.sentences
          : [];

  const text = segments.length
    ? segments.map(formatSegmentForSummary).join("\n")
    : transcript.text ?? "";

  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function formatSegmentForSummary(segment: AaiSegment): string {
  const speaker = segment.speaker?.trim();
  const prefix = speaker ? `${speaker}: ` : "";
  return `${fmtTime(segment.start)} ${prefix}${segment.text}`.trim();
}

function limitSummaryInput(text: string): string {
  if (text.length <= SUMMARY_INPUT_CHAR_LIMIT) return text;
  return [
    text.slice(0, SUMMARY_INPUT_CHAR_LIMIT),
    "",
    "[Transcript truncated because it exceeded the summary input limit.]",
  ].join("\n");
}

function extractResponseText(response: OpenAIResponse): string {
  if (typeof response.output_text === "string") return response.output_text;
  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function summarizeOpenAIResponse(response: OpenAIResponse) {
  return {
    id: response.id,
    status: response.status,
    incompleteReason: response.incomplete_details?.reason,
    outputTypes: response.output?.map((item) => ({
      type: item.type,
      status: item.status,
      contentTypes: item.content?.map((content) => content.type),
    })),
    usage: response.usage,
    error: response.error
      ? { code: response.error.code, message: response.error.message }
      : undefined,
    outputTextChars:
      typeof response.output_text === "string" ? response.output_text.length : undefined,
  };
}

function logSummary(
  requestId: string | undefined,
  event: string,
  details: Record<string, unknown>
) {
  console.info(`[summary:openai${requestId ? `:${requestId}` : ""}] ${event}`, details);
}

function openAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new OpenAISummaryError("OPENAI_API_KEY not set");
  return key;
}

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${ss}`
    : `${m}:${ss}`;
}
