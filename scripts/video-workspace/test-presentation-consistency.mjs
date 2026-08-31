import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  buildAss,
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
  const crops = [
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
