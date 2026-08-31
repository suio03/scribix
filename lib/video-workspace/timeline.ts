import type { Edl, EdlSegment } from "./contracts";

export type ProxyTimelineSource = {
  segmentId: string;
  segmentIndex: number;
  url: string;
  sourceStartMs: number;
  sourceEndMs: number;
  proxySourceStartMs: number;
  proxySourceEndMs: number;
};

export type TimelineSegment = EdlSegment & {
  timelineStartMs: number;
  timelineEndMs: number;
  proxySourceStartMs: number;
  proxySourceEndMs: number;
  proxyStartMs: number;
  proxyEndMs: number;
  proxyUrl: string;
};

export type TranscriptWordBoundary = {
  text: string;
  startMs: number;
  endMs: number;
  speaker: string | null;
};

export function buildTimelineSegments(
  edl: Edl,
  proxies: readonly ProxyTimelineSource[]
): TimelineSegment[] {
  const proxyById = new Map(proxies.map((proxy) => [proxy.segmentId, proxy]));
  let timelineCursorMs = 0;
  return [...edl.segments]
    .sort((left, right) => left.order - right.order)
    .flatMap((segment) => {
      const proxy = proxyById.get(segment.id);
      if (!proxy) return [];
      const durationMs = segment.sourceEndMs - segment.sourceStartMs;
      const mapped = {
        ...segment,
        timelineStartMs: timelineCursorMs,
        timelineEndMs: timelineCursorMs + durationMs,
        proxySourceStartMs: proxy.proxySourceStartMs,
        proxySourceEndMs: proxy.proxySourceEndMs,
        proxyStartMs: segment.sourceStartMs - proxy.proxySourceStartMs,
        proxyEndMs: segment.sourceEndMs - proxy.proxySourceStartMs,
        proxyUrl: proxy.url,
      };
      timelineCursorMs += durationMs;
      return [mapped];
    });
}

export function timelineDurationMs(segments: readonly TimelineSegment[]): number {
  return segments.at(-1)?.timelineEndMs ?? 0;
}

export function timelineSegmentAt(
  segments: readonly TimelineSegment[],
  timelineMs: number
): { segment: TimelineSegment; index: number; localMs: number } | null {
  if (segments.length === 0) return null;
  const durationMs = timelineDurationMs(segments);
  const clamped = Math.min(Math.max(0, timelineMs), Math.max(0, durationMs - 1));
  const index = segments.findIndex((segment) => clamped < segment.timelineEndMs);
  const resolvedIndex = index === -1 ? segments.length - 1 : index;
  const segment = segments[resolvedIndex];
  return {
    segment,
    index: resolvedIndex,
    localMs: clamped - segment.timelineStartMs,
  };
}

export function timelineToSourceMs(
  segments: readonly TimelineSegment[],
  timelineMs: number
): number | null {
  const position = timelineSegmentAt(segments, timelineMs);
  return position ? position.segment.sourceStartMs + position.localMs : null;
}

export function sourceToProxyMs(segment: TimelineSegment, sourceMs: number): number {
  return sourceMs - segment.proxySourceStartMs;
}

export function sourceRangeInsideProxy(
  proxy: Pick<ProxyTimelineSource, "proxySourceStartMs" | "proxySourceEndMs">,
  sourceStartMs: number,
  sourceEndMs: number
): boolean {
  return sourceStartMs >= proxy.proxySourceStartMs && sourceEndMs <= proxy.proxySourceEndMs;
}

export function previousWordStart(
  words: readonly TranscriptWordBoundary[],
  sourceMs: number
): number | null {
  for (let index = words.length - 1; index >= 0; index -= 1) {
    if (words[index].startMs < sourceMs) return words[index].startMs;
  }
  return null;
}

export function nextWordStart(
  words: readonly TranscriptWordBoundary[],
  sourceMs: number
): number | null {
  return words.find((word) => word.startMs > sourceMs)?.startMs ?? null;
}

export function previousWordEnd(
  words: readonly TranscriptWordBoundary[],
  sourceMs: number
): number | null {
  for (let index = words.length - 1; index >= 0; index -= 1) {
    if (words[index].endMs < sourceMs) return words[index].endMs;
  }
  return null;
}

export function nextWordEnd(
  words: readonly TranscriptWordBoundary[],
  sourceMs: number
): number | null {
  return words.find((word) => word.endMs > sourceMs)?.endMs ?? null;
}
