import assert from "node:assert/strict";
import test from "node:test";
import {
  activeCaptionWordIndex,
  browserCropStyle,
  captionVisualStyle,
  coverCropBox,
  logoBox,
  wrapCaptionWordIndexes,
} from "./presentation";

const words = [
  { text: "Preview", sourceStartMs: 1_000, sourceEndMs: 1_400 },
  { text: "matches", sourceStartMs: 1_400, sourceEndMs: 1_800 },
  { text: "render", sourceStartMs: 1_800, sourceEndMs: 2_200 },
];

test("browser crop geometry maps exactly to the final canvas", () => {
  const box = coverCropBox(1920, 1080, { x: 0.25, y: 0.6, zoom: 1.2 });
  assert.deepEqual(box, { width: 4096, height: 2304, left: -754, top: -230 });
  const style = browserCropStyle(box);
  assert.ok(Math.abs(Number.parseFloat(style.width) - 379.2593) < 0.001);
  assert.equal(style.height, "120%");
  assert.ok(Math.abs(Number.parseFloat(style.left) + 69.8148) < 0.001);
  assert.ok(Math.abs(Number.parseFloat(style.top) + 11.9792) < 0.001);
});

test("caption wrapping and active word timing are deterministic", () => {
  assert.deepEqual(wrapCaptionWordIndexes(words, 15, 2), [[0, 1], [2]]);
  assert.equal(activeCaptionWordIndex(words, 1_650), 1);
  assert.equal(activeCaptionWordIndex(words, 2_500), null);
  assert.equal(captionVisualStyle("karaoke-v1").fontSize, 82);
});

test("logo geometry stays inside the shared safe offsets", () => {
  assert.deepEqual(logoBox("bottom-right", 0.16, 400, 200), {
    width: 174,
    height: 88,
    left: 841,
    top: 1678,
  });
});
