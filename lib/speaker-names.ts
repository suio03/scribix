export type SpeakerNames = Record<string, string>;

const MAX_SPEAKERS = 20;
const MAX_SPEAKER_ID_LEN = 32;
const MAX_SPEAKER_NAME_LEN = 80;

export function parseSpeakerNames(value: string | null | undefined): SpeakerNames {
  if (!value) return {};
  try {
    return sanitizeSpeakerNames(JSON.parse(value));
  } catch {
    return {};
  }
}

export function sanitizeSpeakerNames(value: unknown): SpeakerNames {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const out: SpeakerNames = {};
  for (const [rawId, rawName] of Object.entries(value).slice(0, MAX_SPEAKERS)) {
    if (typeof rawName !== "string") continue;
    const id = rawId.trim().slice(0, MAX_SPEAKER_ID_LEN);
    const name = normalizeSpeakerName(rawName);
    if (!id || !name) continue;
    out[id] = name;
  }
  return out;
}

export function speakerNameOrDefault(
  speaker: string | null | undefined,
  speakerNames: SpeakerNames
): string | undefined {
  if (!speaker) return undefined;
  return speakerNames[speaker]?.trim() || `Speaker ${speaker}`;
}

function normalizeSpeakerName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_SPEAKER_NAME_LEN);
}
