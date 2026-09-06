import type { CropSpec, FramingMode, RenderSpec } from "./contracts";
import type { TimelineSegment } from "./timeline";
import { replaceFramingInterval } from "./framing-range";

export type FramingSection = { id: string; segmentId: string; start: number; end: number; mode: FramingMode; crop: CropSpec };

export function framingSections(timeline: TimelineSegment[], spec: RenderSpec): FramingSection[] {
  return timeline.flatMap(segment => {
    const base = spec.segments[segment.id];
    const ranges = base.framingRanges ?? [];
    const boundaries = [segment.sourceStartMs, ...ranges.map(r => r.sourceStartMs).filter(ms => ms > segment.sourceStartMs && ms < segment.sourceEndMs)];
    return boundaries.map((from, index) => {
      const framing = ranges.filter(r => r.sourceStartMs <= from).at(-1) ?? base;
      return { id: `${segment.id}:${from}`, segmentId: segment.id, start: segment.timelineStartMs + from - segment.sourceStartMs, end: segment.timelineStartMs + (boundaries[index + 1] ?? segment.sourceEndMs) - segment.sourceStartMs, mode: framing.framingMode ?? "fill", crop: { ...framing.crop } };
    });
  });
}

export function splitFramingSection(sections: FramingSection[], time: number): FramingSection[] {
  const index = sections.findIndex(s => time >= s.start + 100 && time <= s.end - 100);
  if (index < 0) return sections;
  const section = sections[index];
  return [...sections.slice(0, index), { ...section, end: time }, { ...section, id: `${section.segmentId}:split:${time}`, start: time, crop: { ...section.crop } }, ...sections.slice(index + 1)];
}

// Remove a framing boundary, retaining the neighbour's crop and all video time.
export function mergeFramingSection(sections: FramingSection[], index: number): FramingSection[] {
  const current = sections[index];
  if (!current) return sections;
  const previous = sections[index - 1];
  if (previous?.segmentId === current.segmentId) {
    return [...sections.slice(0, index - 1), { ...previous, end: current.end }, ...sections.slice(index + 1)];
  }
  const next = sections[index + 1];
  if (next?.segmentId === current.segmentId) {
    return [...sections.slice(0, index), { ...next, start: current.start }, ...sections.slice(index + 2)];
  }
  return sections;
}

export function moveFramingBoundary(sections: FramingSection[], index: number, time: number): FramingSection[] {
  const before = sections[index - 1];
  const after = sections[index];
  if (!before || !after || before.segmentId !== after.segmentId || !Number.isFinite(time)) return sections;
  const boundary = Math.round(Math.max(before.start + 100, Math.min(after.end - 100, time)));
  return sections.map((s, i) => i === index - 1 ? { ...s, end: boundary } : i === index ? { ...s, start: boundary } : s);
}

export function applyFramingSections(timeline: TimelineSegment[], spec: RenderSpec, sections: FramingSection[]): RenderSpec {
  const segments = { ...spec.segments };
  for (const section of sections) {
    const segment = timeline.find(s => s.id === section.segmentId)!;
    segments[segment.id] = replaceFramingInterval(segments[segment.id], segment.sourceStartMs + section.start - segment.timelineStartMs, segment.sourceStartMs + section.end - segment.timelineStartMs, section.mode, section.crop);
  }
  return { ...spec, segments };
}
