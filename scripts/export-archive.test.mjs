import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { unzipSync } from "fflate";

const module = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL("../lib/video-workspace/export-archive.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(code, { module, exports: module.exports, require: createRequire(import.meta.url), TransformStream, ReadableStream, Uint8Array, Promise });
const { exportArchive, exportFileName, attachmentHeader } = module.exports;

test("streamed archive contains ordered, intact files across source chunk boundaries", async () => {
  const bytes = Uint8Array.from({ length: 8193 }, (_, i) => i % 251);
  const body = () => new ReadableStream({ start(controller) {
    controller.enqueue(bytes.slice(0, 1));
    controller.enqueue(bytes.slice(1, 4000));
    controller.enqueue(bytes.slice(4000));
    controller.close();
  } });
  const data = new Uint8Array(await new Response(exportArchive([
    { name: "clip-01-日本語.mp4", body: body() }, { name: "clip-02.mp4", body: body() },
  ])).arrayBuffer());
  const files = unzipSync(data);
  assert.deepEqual(Object.keys(files), ["clip-01-日本語.mp4", "clip-02.mp4"]);
  for (const content of Object.values(files)) assert.deepEqual(content, bytes);
});

test("download cancellation releases the active source stream", async () => {
  let canceled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1024)); }, cancel() { canceled = true; } });
  const reader = exportArchive([{ name: "clip.mp4", body }]).getReader();
  await reader.read();
  await reader.cancel();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(canceled, true);
});

test("export names use visible clip numbers and preserve Unicode without unsafe path characters", () => {
  const name = exportFileName("source/episode", 4, "😀".repeat(71));
  assert.match(name, /^source-episode-clip-04-/);
  assert.doesNotThrow(() => attachmentHeader(`${name}.zip`));
  assert.equal(name.includes("/"), false);
});
