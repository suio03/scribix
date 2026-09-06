import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  framedVideoFilter,
  buildAss,
  expandFramingSegments,
  captionStyle as rendererCaptionStyle,
  coverCropGeometry,
  logoOverlay,
  wrapAssWords,
} from "../../containers/video-preview/final-render.mjs";

const root = resolve(import.meta.dirname, "../..");
const outputDirectory = mkdtempSync(join(tmpdir(), "scribix-presentation-contract-"));

try {
  const compile = spawnSync(resolve(root, "node_modules/.bin/tsc"), [
    "lib/video-workspace/contracts.ts",
    "lib/video-workspace/presentation.ts",
    "lib/video-workspace/framing-range.ts",
    "lib/video-workspace/framing-sections.ts",
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--target", "es2022",
    "--esModuleInterop",
    "--skipLibCheck",
    "--outDir", outputDirectory,
  ], { cwd: root, encoding: "utf8" });
  if (compile.stdout) process.stdout.write(compile.stdout);
  if (compile.stderr) process.stderr.write(compile.stderr);
  assert.equal(compile.status, 0, "presentation TypeScript compilation failed");

  const browser = await import(pathToFileURL(join(outputDirectory, "presentation.js")));
  const { framingAt, validAutoFramingPlan } = await import(pathToFileURL(join(outputDirectory, "auto-framing.js")));
  const sectionTools = await import(pathToFileURL(join(outputDirectory, "framing-sections.js")));
  const sectionTimeline = [{ id: "s0", sourceStartMs: 1000, sourceEndMs: 11000, timelineStartMs: 0, timelineEndMs: 10000 }];
  const sectionSpec = { segments: { s0: { framingMode: "auto", crop: { x: .5, y: .5, zoom: 1 } } } };
  const initialSections = sectionTools.framingSections(sectionTimeline, sectionSpec);
  assert.equal(initialSections.length, 1, "opening the editor does not invent a three-second section");
  let sectionDraft = sectionTools.splitFramingSection(initialSections, 6000);
  sectionDraft[0] = { ...sectionDraft[0], mode: "fill", crop: { x: 1, y: .5, zoom: 1 } };
  sectionDraft[1] = { ...sectionDraft[1], mode: "fill", crop: { x: 0, y: .5, zoom: 1 } };
  sectionDraft = sectionTools.splitFramingSection(sectionDraft, 9000);
  sectionDraft[2] = { ...sectionDraft[2], mode: "auto" };
  const movedSections = sectionTools.moveFramingBoundary(sectionDraft, 1, 5000);
  assert.equal(movedSections[0].end, 5000);
  assert.equal(movedSections[1].start, 5000);
  assert.equal(sectionDraft[0].end, 6000, "undo snapshots must stay immutable");
  const sectionOutput = sectionTools.applyFramingSections(sectionTimeline, sectionSpec, movedSections);
  assert.equal(framingAt(sectionOutput.segments.s0, 5999).crop.x, 1);
  assert.equal(framingAt(sectionOutput.segments.s0, 6000).crop.x, 0);
  assert.equal(framingAt(sectionOutput.segments.s0, 10000).framingMode, "fit", "last section resumes automatic fallback");
  assert.equal(sectionSpec.segments.s0.framingRanges, undefined, "draft changes do not mutate saved edits");
  const merged = sectionTools.mergeFramingSection(sectionDraft, 1);
  assert.equal(merged.length, sectionDraft.length - 1);
  assert.equal(merged[0].end, sectionDraft[1].end);
  assert.deepEqual(merged[0].crop, sectionDraft[0].crop, "merge retains previous framing");
  const mergedFirst = sectionTools.mergeFramingSection(sectionDraft, 0);
  assert.equal(mergedFirst[0].start, 0);
  assert.deepEqual(mergedFirst[0].crop, sectionDraft[1].crop, "first section inherits next framing");
  assert.equal(sectionTools.mergeFramingSection(initialSections, 0), initialSections, "one section cannot merge");
  const separateSources = sectionDraft.slice(0, 2).map((section, index) => ({ ...section, segmentId: String(index) }));
  assert.equal(sectionTools.mergeFramingSection(separateSources, 1), separateSources, "cannot merge across source cuts");
  assert.equal(sectionTools.splitFramingSection(sectionDraft, 6000), sectionDraft, "splitting an existing boundary is a no-op");
  const plan = { schemaVersion: 1, analyzer: "test", sourceStartMs: 1000, sourceEndMs: 7000, points: [
    { sourceMs: 1000, framingMode: "fill", crop: { x: .1, y: .5, zoom: 1 } },
    { sourceMs: 3000, framingMode: "fill", crop: { x: .9, y: .5, zoom: 1 } },
    { sourceMs: 5000, framingMode: "fit", crop: { x: .5, y: .5, zoom: 1 } },
  ] };
  assert.equal(validAutoFramingPlan(plan), true);
  assert.equal(validAutoFramingPlan({ ...plan, points: [...plan.points].reverse() }), false);
  const spec = { framingMode: "auto", crop: { x: .5, y: .5, zoom: 1 }, autoFraming: plan, framingRanges: [
    { sourceStartMs: 4000, framingMode: "fill", crop: { x: .4, y: .8, zoom: 2 } },
    { sourceStartMs: 6000, framingMode: "auto", crop: { x: .5, y: .5, zoom: 1 } },
  ] };
  const { replaceFramingInterval } = await import(pathToFileURL(join(outputDirectory, "framing-range.js")));
  const cropped = replaceFramingInterval(spec, 2000, 4500, "fill", { x: .7, y: .5, zoom: 2 });
  for (const time of [0, 1999, 4500, 5000, 6000, 7999]) assert.deepEqual(framingAt(cropped, time), framingAt(spec, time), `outside interval changed at ${time}`);
  for (const time of [2000, 3000, 4499]) assert.equal(framingAt(cropped, time).crop.x, .7);
  assert.equal(cropped.framingRanges.filter(range => range.sourceStartMs === 4500).length, 1);
  const automaticAfter = replaceFramingInterval(spec, 2000, 3000, "fit", { x: .5, y: .5, zoom: 1 });
  assert.deepEqual(framingAt(automaticAfter, 3500), framingAt(spec, 3500), "automatic following resumes after correction");
  const parts = expandFramingSegments({ segments: [{ id: "s0", order: 0, sourceStartMs: 0, sourceEndMs: 8000 }] }, { segments: { s0: spec } });
  for (const time of [0, 999, 1000, 2999, 3000, 3999, 4000, 5999, 6000, 7000, 7999]) {
    const part = parts.find(item => time >= item.sourceStartMs && time < item.sourceEndMs);
    const actual = part.autoPoints?.filter(point => point.sourceMs <= time).at(-1) ?? part.framing;
    const preview = framingAt(spec, time);
    assert.equal(actual.framingMode, preview.framingMode, `mode mismatch at ${time}`);
    assert.deepEqual(actual.crop, preview.crop, `crop mismatch at ${time}`);
  }
  const zoomPlan = { ...plan, points: [
    { sourceMs: 1000, framingMode: "fill", crop: { x: .1, y: .3, zoom: .5 } },
    { sourceMs: 3000, framingMode: "fill", crop: { x: .9, y: .7, zoom: .65 } },
  ] };
  assert.equal(validAutoFramingPlan(zoomPlan), true);
  for (const invalid of [0, -.1, 4.1, NaN]) assert.equal(validAutoFramingPlan({ ...zoomPlan, points: [{ ...zoomPlan.points[0], crop: { ...zoomPlan.points[0].crop, zoom: invalid } }] }), false);
  const zoomSpec = { ...spec, autoFraming: zoomPlan, framingRanges: [] };
  const zoomParts = expandFramingSegments({ segments: [{ id: "s0", order: 0, sourceStartMs: 1000, sourceEndMs: 7000 }] }, { segments: { s0: zoomSpec } });
  assert.equal(zoomParts.length, 2, "zoom changes split rendering geometry");
  for (const part of zoomParts) assert.deepEqual(part.framing.crop, framingAt(zoomSpec, part.sourceStartMs).crop);
  // Actual FFmpeg pixels: scaled white source against black padding. This catches
  // invalid pad/crop combinations and proves vertical placement when zoom < 1.
  for (const zoom of [.1, .5, 1, 1.5]) {
    const crop = { x: .5, y: .25, zoom };
    const filter = framedVideoFilter({ width: 1920, height: 1080 }, crop, "#000000");
    const result = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=white:s=1920x1080", "-vf", filter, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"], { maxBuffer: 8_000_000 });
    assert.equal(result.status, 0, result.stderr.toString());
    assert.equal(result.stdout.length, 1080*1920*3);
    const box = browser.coverCropBox(1920, 1080, crop);
    for (const y of [10, 300, 800, 1400, 1900]) {
      const visible = y > box.top+2 && y < box.top+box.height-2;
      const pixel = result.stdout[(y*1080+540)*3];
      assert.ok(visible ? pixel > 240 : pixel < 10, `wrong padding at zoom ${zoom}, row ${y}`);
    }
  }
  const manual = { ...spec, framingMode: "fill", framingRanges: [] };
  assert.equal(expandFramingSegments({ segments: [{ id: "s0", order: 0, sourceStartMs: 0, sourceEndMs: 8000 }] }, { segments: { s0: manual } }).length, 1, "analysis must not alter manual rendering");
  const crops = [
    { x: .5, y: .25, zoom: .5 },
    { x: 1, y: 1, zoom: .1 },
    { x: .2, y: .8, zoom: .31641 },
    { x: 0, y: 0, zoom: 1 },
    { x: 0.25, y: 0.6, zoom: 1.2 },
    { x: 1, y: 1, zoom: 2.4 },
  ];
  for (const crop of crops) {
    const browserBox = browser.coverCropBox(1920, 1080, crop);
    const rendererBox = coverCropGeometry(1920, 1080, crop);
    assert.deepEqual(rendererBox, {
      width: browserBox.width,
      height: browserBox.height,
      cropX: -browserBox.left,
      cropY: -browserBox.top,
    });
  }

  for (const templateId of ["karaoke-v1", "boxed-v1", "minimal-v1"]) {
    const browserStyle = browser.captionVisualStyle(templateId);
    const rendererStyle = rendererCaptionStyle(templateId);
    assert.equal(rendererStyle.fontSize, browserStyle.fontSize);
    assert.equal(rendererStyle.bold !== 0, browserStyle.fontWeight >= 700);
    assert.equal(rendererStyle.borderStyle === 3, browserStyle.boxed);
    assert.equal(rendererStyle.outline, browserStyle.outline);
    assert.equal(rendererStyle.shadow, browserStyle.shadow);
    assert.equal(rendererStyle.uppercase, browserStyle.uppercase);
  }

  const words = [
    { text: "Preview", sourceStartMs: 1_000, sourceEndMs: 1_400 },
    { text: "matches", sourceStartMs: 1_400, sourceEndMs: 1_800 },
    { text: "render", sourceStartMs: 1_800, sourceEndMs: 2_200 },
  ];
  const browserLines = browser.wrapCaptionWordIndexes(words, 15, 2)
    .map((line) => line.map((index) => words[index].text).join(" "));
  const rendererLines = wrapAssWords(words, 15, 2)
    .replaceAll(/\{[^}]*\}/g, "")
    .split("\\N");
  assert.deepEqual(rendererLines, browserLines);

  assert.deepEqual(logoOverlay("top-left"), { x: "65", y: "115" });
  assert.deepEqual(logoOverlay("bottom-right"), { x: "W-w-65", y: "H-h-154" });

  const edl = {
    schemaVersion: 1,
    segments: [{ id: "seg-1", sourceStartMs: 1_000, sourceEndMs: 3_000, order: 0 }],
  };
  const renderSpec = {
    captions: {
      enabled: true,
      templateId: "karaoke-v1",
      textColor: "#ffffff",
      highlightColor: "#ff5a1f",
      positionY: 0.72,
      maxCharsPerLine: 15,
      maxLines: 2,
      cues: [{
        id: "cue-1",
        segmentId: "seg-1",
        sourceStartMs: 1_000,
        sourceEndMs: 2_200,
        words,
      }],
    },
  };
  for (const templateId of ["karaoke-v1", "boxed-v1", "minimal-v1"]) {
    for (const fontScale of [0.5, 1, 1.5]) {
      const scaled = buildAss(edl, { ...renderSpec, captions: { ...renderSpec.captions, templateId, fontScale } });
      const styleLine = scaled.split("\n").find(line => line.startsWith("Style: Default,"));
      assert.equal(Number(styleLine.split(",")[2]), browser.captionVisualStyle(templateId).fontSize * fontScale, "export must use the preview subtitle size");
    }
  }
  const ass = buildAss(edl, renderSpec);
  assert.match(ass, /Dialogue: 0,0:00:00\.40,0:00:00\.80/);
  assert.match(ass, /\{\\c&H001f5aff\}MATCHES/);
  assert.equal((ass.match(/^Dialogue:/gm) ?? []).length, 3);

  console.log(JSON.stringify({
    event: "presentation_consistency_passed",
    cropFixtures: crops.length,
    captionTemplates: 3,
    captionIntervals: 3,
  }));
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
