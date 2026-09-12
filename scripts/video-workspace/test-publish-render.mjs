import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import vm from "node:vm";
import ts from "typescript";
import * as fflate from "fflate";
import { renderFinal, buildAss } from "../../containers/video-preview/final-render.mjs";
const work = process.env.PUBLISH_PROOF_DIR ?? join(tmpdir(), "scribix-publish-proof");
await mkdir(work, { recursive: true });
const source = resolve("public/media/video-proof/original-source.mp4");
const lease = JSON.parse(await readFile("scripts/video-workspace/fixtures/render-v1.json", "utf8"));
// Real source footage, with explicitly synthetic text used only to verify composition.
lease.edl = { schemaVersion: 1, segments: [{ id: "s0", sourceStartMs: 0, sourceEndMs: 4000, order: 0 }] };
lease.renderSpec.segments = { s0: { framingMode: "fit", crop: { x: 0.5, y: 0.5, zoom: 1 } } };
lease.renderSpec.coverTimelineMs = 1000;
lease.renderSpec.brand = { templateId: null, logoAssetId: null, accentColor: "#6C35FF", logoPosition: "top-right", logoScale: 0.16 };
lease.renderSpec.captions = { ...lease.renderSpec.captions, enabled: true, fontAssetId: null, positionY: 0.78, cues: [{ id: "cue", segmentId: "s0", sourceStartMs: 0, sourceEndMs: 4000, words: [{ text: "Caption test", sourceStartMs: 0, sourceEndMs: 4000 }] }] };
lease.renderSpec.openingTitle = { enabled: true, text: "共有する前に、伝えたいことを確かめる — Überlegen avant de partager", durationMs: 3000, fontScale: 1, positionY: 0.22, color: "#FFFFFF" };
lease.renderSpec.coverTitle = { ...lease.renderSpec.openingTitle, text: "独立したカバー · Independent cover", color: "#FFD600" };
lease.logoUrl = null; lease.fontUrl = null;
const rendered = await renderFinal({ lease, workingDirectory: work, sourceInput: source });
const video = await readFile(rendered.outputPath); const cover = await readFile(rendered.coverPath);
assert.equal(rendered.output.videoCodec, "h264"); assert.equal(rendered.output.audioCodec, "aac");
assert.equal(cover.readUInt16BE(0), 0xffd8);
assert.match(buildAss(lease.edl, lease.renderSpec), /0:00:03.00/);
assert.match(buildAss(lease.edl, lease.renderSpec), /共有する/);
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", "1", "-i", rendered.outputPath, "-frames:v", "1", "-y", join(work, "video-at-1s.png")]);
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", "3.5", "-i", rendered.outputPath, "-frames:v", "1", "-y", join(work, "video-at-3.5s.png")]);
const referenceDir = join(work, "reference"); await mkdir(referenceDir, { recursive: true });
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(video);
try {
  const referenceLease = structuredClone(lease); referenceLease.reusableVideoUrl = "https://fixture.test/reuse";
  referenceLease.renderSpec.captions.enabled = false; referenceLease.renderSpec.openingTitle.enabled = false;
  const reference = await renderFinal({ lease: referenceLease, workingDirectory: referenceDir, sourceInput: source });
  assert.deepEqual(await readFile(reference.coverPath), cover, "cover must not inherit burned captions or opening title");
  assert.deepEqual(await readFile(reference.outputPath), video, "valid video reuse must not reencode");
  const partialDir = join(work, "partial"); await mkdir(join(partialDir, "cover.jpg"), { recursive: true });
  const partial = await renderFinal({ lease: referenceLease, workingDirectory: partialDir, sourceInput: source, allowPartial: true });
  assert.equal(partial.videoError, null); assert.ok(partial.coverError); assert.deepEqual(await readFile(partial.outputPath), video);
  await rm(partialDir, { recursive: true, force: true });
} finally { globalThis.fetch = originalFetch; }
const exports = {};
vm.runInNewContext(ts.transpileModule(await readFile("lib/video-workspace/export-archive.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: () => fflate, TransformStream, Uint8Array, Promise });
const post = "Publishing fixture\n\n日本語の本文。Übung en français.\n\n#video #共有\n";
const archive = await new Response(exports.exportArchive([
  { name: "clip.mp4", body: new Blob([video]).stream() },
  { name: "cover.jpg", body: new Blob([cover]).stream() },
  { name: "post.txt", body: new Blob([post]).stream() },
])).arrayBuffer();
await writeFile(join(work, "publish-kit.zip"), new Uint8Array(archive));
const files = fflate.unzipSync(new Uint8Array(archive));
assert.deepEqual(Object.keys(files), ["clip.mp4", "cover.jpg", "post.txt"]);
assert.equal(new TextDecoder().decode(files["post.txt"]), post);
assert.deepEqual(Buffer.from(files["clip.mp4"]), video);
console.log(JSON.stringify({ event: "publish_render_passed", videoBytes: video.length, coverBytes: cover.length, zipBytes: archive.byteLength, artifacts: work }));
