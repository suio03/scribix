// AssemblyAI client. Edge-compatible (uses fetch).
// Submit URL-based transcripts and fetch results.

const AAI_BASE = "https://api.assemblyai.com/v2";

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
