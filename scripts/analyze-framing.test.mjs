import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeFraming, framingDiagnostic } from "../containers/video-preview/analyze-framing.mjs";

test("failed analyzer keeps a bounded diagnostic and safely falls back", async () => {
  const logs = [];
  const previous = console.warn;
  console.warn = line => logs.push(JSON.parse(line));
  try {
    const result = await analyzeFraming({ input: "/private/video.mp4", workingDirectory: "/tmp", sourceStartMs: 100, durationMs: 2000, jobId: "job" }, {
      spawnProcess() {
        const child = new EventEmitter(); child.stderr = new EventEmitter();
        queueMicrotask(() => { child.stderr.emit("data", "x".repeat(9000) + "\nModuleNotFoundError: missing_model"); child.emit("close", 1, null); });
        return child;
      },
    });
    assert.equal(result.analyzer, "analysis-unavailable-v1");
    assert.equal(result.points[0].framingMode, "fit");
    assert.equal(logs[0].exitCode, 1);
    assert.equal(logs[0].jobId, "job");
    assert.match(logs[0].stderr, /ModuleNotFoundError/);
    assert.ok(logs[0].stderr.length <= 4096);
  } finally { console.warn = previous; }
});

test("successful analyzer waits for close and returns the generated plan", async () => {
  const directory = await mkdtemp(join(tmpdir(), "framing-test-"));
  const plan = { analyzer: "fixture", points: [{ framingMode: "fill" }] };
  try {
    const result = await analyzeFraming({ input: "fixture", workingDirectory: directory, sourceStartMs: 0, durationMs: 2000 }, {
      spawnProcess() {
        const child = new EventEmitter(); child.stderr = new EventEmitter();
        void writeFile(join(directory, "auto-framing.json"), JSON.stringify(plan)).then(() => child.emit("close", 0, null));
        return child;
      },
    });
    assert.deepEqual(result, plan);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("diagnostics redact input paths, signed URLs and control bytes", () => {
  const text = framingDiagnostic('File "/private/video.mp4" https://r2.test/file?token=secret\u0000\nRuntimeError: unavailable');
  assert.doesNotMatch(text, /secret|private|\u0000/);
  assert.match(text, /RuntimeError: unavailable/);
});

test("timeout kills the analyzer and reports a distinct failure reason", async () => {
  const logs = [];
  const previous = console.warn;
  console.warn = line => logs.push(JSON.parse(line));
  let killed = false;
  try {
    const result = await analyzeFraming({ input: "fixture", workingDirectory: "/tmp", sourceStartMs: 0, durationMs: 2000 }, {
      timeoutMs: 5,
      spawnProcess() {
        const child = new EventEmitter(); child.stderr = new EventEmitter();
        child.kill = signal => { killed = signal === "SIGKILL"; };
        return child;
      },
    });
    assert.equal(killed, true);
    assert.equal(result.analyzer, "analysis-unavailable-v1");
    assert.equal(logs[0].reason, "analysis_timeout");
  } finally { console.warn = previous; }
});
