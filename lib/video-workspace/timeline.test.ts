import assert from "node:assert/strict";
import test from "node:test";
import type { Edl } from "./contracts";
import {
  buildTimelineSegments,
  nextWordEnd,
  previousWordStart,
  sourceRangeInsideProxy,
  sourceToProxyMs,
  timelineDurationMs,
  timelineSegmentAt,
  timelineToSourceMs,
  type ProxyTimelineSource,
  type TranscriptWordBoundary,
} from "./timeline";

const edl: Edl = {
  schemaVersion: 1,
  segments: [
    { id: "s1", sourceStartMs: 20_000, sourceEndMs: 24_000, order: 1 },
    { id: "s0", sourceStartMs: 5_000, sourceEndMs: 8_000, order: 0 },
  ],
};
const proxies: ProxyTimelineSource[] = [
  {
    segmentId: "s0",
    segmentIndex: 0,
    url: "https://example.test/s0.mp4",
    sourceStartMs: 5_000,
    sourceEndMs: 8_000,
    proxySourceStartMs: 2_000,
    proxySourceEndMs: 11_000,
  },
  {
    segmentId: "s1",
    segmentIndex: 1,
    url: "https://example.test/s1.mp4",
    sourceStartMs: 20_000,
    sourceEndMs: 24_000,
    proxySourceStartMs: 15_000,
    proxySourceEndMs: 29_000,
  },
];

test("maps source, proxy, and continuous timeline time without gaps", () => {
  const timeline = buildTimelineSegments(edl, proxies);
  assert.deepEqual(timeline.map((segment) => [
    segment.id,
    segment.timelineStartMs,
    segment.timelineEndMs,
    segment.proxyStartMs,
    segment.proxyEndMs,
  ]), [
    ["s0", 0, 3_000, 3_000, 6_000],
    ["s1", 3_000, 7_000, 5_000, 9_000],
  ]);
  assert.equal(timelineDurationMs(timeline), 7_000);
  assert.equal(timelineToSourceMs(timeline, 3_500), 20_500);
  assert.equal(sourceToProxyMs(timeline[1], 20_500), 5_500);
  assert.equal(timelineSegmentAt(timeline, 3_000)?.index, 1);
});

test("checks edited ranges against proxy handles", () => {
  assert.equal(sourceRangeInsideProxy(proxies[0], 2_000, 11_000), true);
  assert.equal(sourceRangeInsideProxy(proxies[0], 1_999, 8_000), false);
});

test("steps edit boundaries across real transcript words", () => {
  const words: TranscriptWordBoundary[] = [
    { text: "one", startMs: 1_000, endMs: 1_300, speaker: null },
    { text: "two", startMs: 1_400, endMs: 1_700, speaker: null },
    { text: "three", startMs: 1_800, endMs: 2_200, speaker: null },
  ];
  assert.equal(previousWordStart(words, 1_800), 1_400);
  assert.equal(nextWordEnd(words, 1_700), 2_200);
});
