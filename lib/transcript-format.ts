// SRT / VTT serializers for AssemblyAI transcript JSON.
// Prefers utterances (speaker-segmented) and falls back to chunked words.

import type { AaiTranscript } from "./aai";

type Word = NonNullable<AaiTranscript["words"]>[number];
type Cue = { start: number; end: number; text: string; speaker?: string };

const WORDS_PER_CUE = 8;

function cuesFromAai(aai: AaiTranscript): Cue[] {
  if (aai.utterances?.length) {
    return aai.utterances.map((u) => ({
      start: u.start,
      end: u.end,
      text: u.text,
      speaker: u.speaker,
    }));
  }
  if (aai.words?.length) return chunkWords(aai.words, WORDS_PER_CUE);
  return [];
}

function chunkWords(words: Word[], n: number): Cue[] {
  const out: Cue[] = [];
  for (let i = 0; i < words.length; i += n) {
    const chunk = words.slice(i, i + n);
    if (!chunk.length) continue;
    out.push({
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      text: chunk.map((w) => w.text).join(" "),
    });
  }
  return out;
}

function pad(n: number, w: number) {
  return n.toString().padStart(w, "0");
}

function timestamp(ms: number, sep: "," | "."): string {
  const total = Math.max(0, Math.floor(ms));
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const r = total % 1000;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${sep}${pad(r, 3)}`;
}

export function toSrt(aai: AaiTranscript): string {
  const cues = cuesFromAai(aai);
  return cues
    .map((c, i) => {
      const text = c.speaker ? `[Speaker ${c.speaker}] ${c.text}` : c.text;
      return `${i + 1}\n${timestamp(c.start, ",")} --> ${timestamp(c.end, ",")}\n${text}\n`;
    })
    .join("\n");
}

export function toVtt(aai: AaiTranscript): string {
  const cues = cuesFromAai(aai);
  const body = cues
    .map((c) => {
      const text = c.speaker ? `<v Speaker ${c.speaker}>${c.text}` : c.text;
      return `${timestamp(c.start, ".")} --> ${timestamp(c.end, ".")}\n${text}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${body}`;
}
