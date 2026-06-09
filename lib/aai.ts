// AssemblyAI client. Edge-compatible (uses fetch).
// Submit URL-based transcripts and fetch results.

const AAI_BASE = "https://api.assemblyai.com/v2";
const AAI_UNDERSTANDING_BASE = "https://llm-gateway.assemblyai.com/v1";

export type AaiSubmit = {
  audio_url: string;
  speech_models: readonly string[];
  speaker_labels?: boolean;
  language_detection?: boolean;
  audio_end_at?: number;
  webhook_url?: string;
  webhook_auth_header_name?: string;
  webhook_auth_header_value?: string;
};

export type AaiSegment = {
  text: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: string | null;
};

export type AaiTranscript = {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  audio_duration?: number;
  language_code?: string;
  text?: string;
  error?: string;
  speech_model?: string;
  utterances?: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
  words?: Array<{ text: string; start: number; end: number; speaker?: string }>;
  // Populated server-side at completion (not part of AAI's own response).
  paragraphs?: AaiSegment[];
  sentences?: AaiSegment[];
};

export type AaiTranslatedUtterance = {
  speaker?: string | null;
  text: string;
  start: number;
  end: number;
  translated_texts?: Record<string, string>;
};

export type AaiTranslation = {
  id?: string;
  status?: string;
  text?: string;
  translated_texts?: Record<string, string>;
  utterances?: AaiTranslatedUtterance[];
  speech_understanding?: {
    response?: {
      translation?: {
        status?: string;
      };
    };
  };
};

type AaiChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class AaiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string
  ) {
    super(message);
    this.name = "AaiApiError";
  }
}

function key() {
  const k = process.env.ASSEMBLYAI_API_KEY;
  if (!k) throw new Error("ASSEMBLYAI_API_KEY not set");
  return k;
}

export async function submitTranscript(body: AaiSubmit): Promise<AaiTranscript> {
  const res = await fetch(`${AAI_BASE}/transcript`, {
    method: "POST",
    headers: {
      authorization: key(),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AAI submit failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getTranscript(id: string): Promise<AaiTranscript> {
  const res = await fetch(`${AAI_BASE}/transcript/${id}`, {
    headers: { authorization: key() },
  });
  if (!res.ok) throw new Error(`AAI fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getParagraphs(id: string): Promise<AaiSegment[]> {
  const res = await fetch(`${AAI_BASE}/transcript/${id}/paragraphs`, {
    headers: { authorization: key() },
  });
  if (!res.ok) throw new Error(`AAI paragraphs fetch failed: ${res.status}`);
  const json = (await res.json()) as { paragraphs?: AaiSegment[] };
  return json.paragraphs ?? [];
}

export async function getSentences(id: string): Promise<AaiSegment[]> {
  const res = await fetch(`${AAI_BASE}/transcript/${id}/sentences`, {
    headers: { authorization: key() },
  });
  if (!res.ok) throw new Error(`AAI sentences fetch failed: ${res.status}`);
  const json = (await res.json()) as { sentences?: AaiSegment[] };
  return json.sentences ?? [];
}

export async function translateTranscript(
  transcriptId: string,
  targetLanguage: string
): Promise<AaiTranslation> {
  const res = await fetch(`${AAI_UNDERSTANDING_BASE}/understanding`, {
    method: "POST",
    headers: {
      authorization: key(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      transcript_id: transcriptId,
      speech_understanding: {
        request: {
          translation: {
            target_languages: [targetLanguage],
            formal: false,
            match_original_utterance: true,
          },
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`AAI translation failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function summarizeTranscriptById(transcriptId: string): Promise<string> {
  const prompt = [
    "Summarize this transcript for a busy professional.",
    "Use this exact structure:",
    "Overview: one concise paragraph.",
    "Key points: 3-6 bullets.",
    "Action items: bullets only if concrete action items are mentioned.",
    "Keep the summary factual and do not invent names, decisions, or tasks.",
    "",
    "Transcript:",
    "{{ transcript }}",
  ].join("\n");

  const res = await fetch(`${AAI_UNDERSTANDING_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: key(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      prompt,
      transcript_id: transcriptId,
      max_tokens: 900,
    }),
  });
  if (!res.ok) {
    throw new AaiApiError("AAI summary failed", res.status, await res.text());
  }
  const json = (await res.json()) as AaiChatCompletion;
  const summary = json.choices?.[0]?.message?.content?.trim();
  if (!summary) throw new Error("AAI summary response was empty");
  return summary;
}
