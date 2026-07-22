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

export type AaiSubmitResult = {
  transcript: AaiTranscript;
  attempts: number;
};

export class AaiSubmitError extends Error {
  constructor(
    message: string,
    readonly category: "http" | "network" | "invalid_response",
    readonly attempts: number,
    readonly status?: number
  ) {
    super(message);
    this.name = "AaiSubmitError";
  }
}

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

function key() {
  const k = process.env.ASSEMBLYAI_API_KEY;
  if (!k) throw new Error("ASSEMBLYAI_API_KEY not set");
  return k;
}

export async function submitTranscript(body: AaiSubmit): Promise<AaiSubmitResult> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(`${AAI_BASE}/transcript`, {
        method: "POST",
        headers: {
          authorization: key(),
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      // A network timeout is ambiguous: the upstream may have accepted the
      // request even though we did not receive its response. Never auto-submit
      // again in this case because that could create a duplicate job.
      throw new AaiSubmitError(
        error instanceof Error ? error.message : "AAI submit network error",
        "network",
        attempt
      );
    }

    if (res.ok) {
      try {
        return { transcript: await res.json(), attempts: attempt };
      } catch {
        throw new AaiSubmitError("AAI submit returned invalid JSON", "invalid_response", attempt);
      }
    }

    const responseBody = (await res.text()).slice(0, 500);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === maxAttempts) {
      throw new AaiSubmitError(
        `AAI submit failed: ${res.status} ${responseBody}`,
        "http",
        attempt,
        res.status
      );
    }

    const retryAfter = Number(res.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(10_000, retryAfter * 1000)
      : attempt * 750;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new AaiSubmitError("AAI submit exhausted retries", "http", maxAttempts);
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
