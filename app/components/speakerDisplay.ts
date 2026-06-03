import type { SpeakerNames } from "@/lib/speaker-names";

export type { SpeakerNames };

export const SPEAKER_TONES = [
  "border-sky-200 bg-sky-50 text-sky-800",
  "border-emerald-200 bg-emerald-50 text-emerald-800",
  "border-amber-200 bg-amber-50 text-amber-800",
  "border-rose-200 bg-rose-50 text-rose-800",
  "border-indigo-200 bg-indigo-50 text-indigo-800",
  "border-cyan-200 bg-cyan-50 text-cyan-800",
  "border-lime-200 bg-lime-50 text-lime-800",
  "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
] as const;

export function speakerToneFor(speaker: string): string {
  let hash = 0;
  for (let i = 0; i < speaker.length; i += 1) {
    hash = (hash * 31 + speaker.charCodeAt(i)) >>> 0;
  }
  return SPEAKER_TONES[hash % SPEAKER_TONES.length];
}

export function displaySpeakerName(
  speaker: string,
  speakerNames: SpeakerNames,
  fallback: (speaker: string) => string
): string {
  const custom = speakerNames[speaker]?.trim();
  return custom || fallback(speaker);
}
