// SRT / VTT / CSV / DOCX serializers for AssemblyAI transcript JSON.
// Prefers utterances (speaker-segmented) and falls back to chunked words.

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { AaiTranscript } from "./aai";
import { speakerNameOrDefault, type SpeakerNames } from "./speaker-names";

type Word = NonNullable<AaiTranscript["words"]>[number];
type Cue = { start: number; end: number; text: string; speaker?: string };

const WORDS_PER_CUE = 8;

// AAI tokenizes CJK output with whitespace between every token, which is correct
// for word-level data but visually broken when rendered as a sentence. Strip
// whitespace between adjacent CJK characters; leave Latin/digit spacing alone.
const CJK_RANGE = "\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uAC00-\\uD7AF\\uFF66-\\uFF9F";
const CJK_SPACE_RE = new RegExp(`([${CJK_RANGE}])\\s+(?=[${CJK_RANGE}])`, "g");

export function compactCJKSpaces(text: string): string {
  return text.replace(CJK_SPACE_RE, "$1");
}

function cuesFromAai(aai: AaiTranscript): Cue[] {
  if (aai.utterances?.length) {
    return aai.utterances.map((u) => ({
      start: u.start,
      end: u.end,
      text: compactCJKSpaces(u.text),
      speaker: u.speaker,
    }));
  }
  if (aai.paragraphs?.length) {
    return aai.paragraphs.map((p) => ({
      start: p.start,
      end: p.end,
      text: compactCJKSpaces(p.text),
      speaker: p.speaker ?? undefined,
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
      text: compactCJKSpaces(chunk.map((w) => w.text).join(" ")),
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

function shortStamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${pad(m, 2)}:${pad(s, 2)}`;
  return `${pad(m, 2)}:${pad(s, 2)}`;
}

export function toTxt(
  aai: AaiTranscript,
  withTimestamps = false,
  speakerNames: SpeakerNames = {}
): string {
  if (!withTimestamps) return compactCJKSpaces(aai.text ?? "");
  const cues = cuesFromAai(aai);
  if (cues.length === 0) return compactCJKSpaces(aai.text ?? "");
  return cues
    .map((c) => {
      const speaker = speakerNameOrDefault(c.speaker, speakerNames);
      const head = speaker ? `[${shortStamp(c.start)}] ${speaker}` : `[${shortStamp(c.start)}]`;
      return `${head}\n${c.text}`;
    })
    .join("\n\n") + "\n";
}

export function toSrt(aai: AaiTranscript, speakerNames: SpeakerNames = {}): string {
  const cues = cuesFromAai(aai);
  return cues
    .map((c, i) => {
      const speaker = speakerNameOrDefault(c.speaker, speakerNames);
      const text = speaker ? `[${speaker}] ${c.text}` : c.text;
      return `${i + 1}\n${timestamp(c.start, ",")} --> ${timestamp(c.end, ",")}\n${text}\n`;
    })
    .join("\n");
}

export function toVtt(aai: AaiTranscript, speakerNames: SpeakerNames = {}): string {
  const cues = cuesFromAai(aai);
  const body = cues
    .map((c) => {
      const speaker = speakerNameOrDefault(c.speaker, speakerNames);
      const text = speaker ? `<v ${speaker}>${c.text}` : c.text;
      return `${timestamp(c.start, ".")} --> ${timestamp(c.end, ".")}\n${text}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

export function toCsv(aai: AaiTranscript, speakerNames: SpeakerNames = {}): string {
  const cues = cuesFromAai(aai);
  const header = "start,end,speaker,text\n";
  const rows = cues
    .map(
      (c) =>
        `${timestamp(c.start, ".")},${timestamp(c.end, ".")},${csvField(
          speakerNameOrDefault(c.speaker, speakerNames) ?? ""
        )},${csvField(c.text)}`
    )
    .join("\n");
  return header + rows + "\n";
}

function csvField(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function toDocx(
  aai: AaiTranscript,
  title: string,
  withTimestamps = true,
  speakerNames: SpeakerNames = {}
): Promise<Uint8Array> {
  const cues = cuesFromAai(aai);
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: title, bold: true })],
    }),
  ];
  if (cues.length === 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: compactCJKSpaces(aai.text ?? "") })],
      })
    );
  } else {
    for (const c of cues) {
      const speaker = speakerNameOrDefault(c.speaker, speakerNames);
      if (withTimestamps) {
        const stamp = timestamp(c.start, ".");
        const meta = speaker ? `${stamp}  ${speaker}` : stamp;
        children.push(
          new Paragraph({
            spacing: { before: 200, after: 60 },
            children: [
              new TextRun({ text: meta, bold: true, color: "888888", size: 18 }),
            ],
          })
        );
      } else if (speaker) {
        children.push(
          new Paragraph({
            spacing: { before: 200, after: 60 },
            children: [
              new TextRun({ text: speaker, bold: true, color: "888888", size: 18 }),
            ],
          })
        );
      }
      children.push(
        new Paragraph({
          spacing: withTimestamps ? undefined : { before: c.speaker ? 0 : 200, after: 60 },
          children: [new TextRun({ text: c.text })],
        })
      );
    }
  }
  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBuffer(doc);
}
