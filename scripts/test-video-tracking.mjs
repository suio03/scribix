import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function load(path, globals = {}, imports = {}) {
  const output = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module, exports: module.exports, console, crypto: webcrypto,
    require: (id) => { assert.ok(id in imports, `unexpected import ${id}`); return imports[id]; },
    ...globals,
  });
  return module.exports;
}
const contract = load("lib/video-workspace/analytics-contract.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("outgoing properties contain only approved facts, rejecting free text, IDs and nonfinite values", () => {
  assert.deepEqual(plain(contract.publicVideoProperties({
    plan_tier: "pro", elapsedMs: 1234.5, file_size_mb: 12, duration_sec: 60,
    error_code: "upload_failed", filename: "private.mp4", transcript: "private content",
    projectId: "private-id", url: "https://private", signed_in: true,
    placement: "hero", origin: "ai", candidate_count: 5,
  })), { plan_tier: "pro", elapsed_ms: 1235, file_size_mb: 12, duration_sec: 60, error_code: "upload_failed" });
  assert.deepEqual(plain(contract.publicVideoProperties({ error_code: "private error text", duration_sec: Infinity, elapsed_ms: -1, plan_tier: "unknown", constructor: "anything" })), {});
});

function analyticsHarness() {
  const requests = [], ga = [], clarity = [], old = [];
  const window = {
    location: { hostname: "scribix.io", href: "https://scribix.io/dashboard/video-projects/PRIVATE" },
    localStorage: { getItem: () => null },
    gtag: (...args) => ga.push(args), clarity: (...args) => clarity.push(args),
    plausible: (...args) => old.push(args),
  };
  const analytics = load("lib/analytics.ts", {
    window, fetch: async (...args) => { requests.push(args); return { ok: true }; },
  }, { "./video-workspace/analytics-contract": contract });
  return { ...analytics, requests, ga, clarity, old, window };
}

test("video events use a fixed URL, no referrer and safe properties across the three sinks", () => {
  const h = analyticsHarness();
  h.trackEvent("video_upload_completed", { plan_tier: "pro", file_size_mb: 10, projectId: "PRIVATE", filename: "PRIVATE" });
  assert.equal(h.requests.length, 1);
  const [url, options] = h.requests[0];
  assert.equal(url, "https://actone.app/api/event");
  assert.equal(options.referrerPolicy, "no-referrer");
  assert.equal(options.credentials, "omit");
  assert.equal(JSON.parse(options.body).u, "https://scribix.io/video-workspace");
  assert.equal(JSON.stringify([h.requests, h.ga, h.clarity]).includes("PRIVATE"), false);
  assert.equal(h.ga[0][1], "video_upload_completed");
  assert.equal(h.clarity[0][1], "video_upload_completed");
  assert.equal(h.old.length, 0);
});

test("one failing sink does not block the others or change original payment tracking", () => {
  const h = analyticsHarness();
  h.window.gtag = () => { throw new Error("blocked"); };
  assert.doesNotThrow(() => h.trackEvent("video_render_completed", {}));
  assert.equal(h.requests.length, 1);
  assert.equal(h.clarity.length, 1);
  h.trackEvent("checkout_click", { tier: "pro", cycle: "monthly", signed_in: true });
  assert.equal(h.old[0][0], "checkout_click");
  assert.equal(h.requests.length, 1);
});

test("render events follow live transitions without replaying historical results or repeated polls", () => {
  const calls = [];
  const client = load("app/components/video-event-client.ts", {}, {
    "@/lib/analytics": { trackEvent: (...args) => calls.push(args) },
    "@/lib/video-workspace/analytics-contract": contract,
  });
  const previous = new Map([["live", "running"]]);
  const finished = { id: "live", status: "completed", createdAt: "2026-09-07 00:00:00", completedAt: "2026-09-07 00:00:02", errorCode: null };
  client.observeVideoRenderResults(previous, [finished, { ...finished, id: "historical" }]);
  client.observeVideoRenderResults(previous, [finished]);
  assert.deepEqual(plain(calls), [["video_render_completed", { elapsed_ms: 2000 }]]);
  previous.set("live", "queued");
  client.observeVideoRenderResults(previous, [{ ...finished, status: "failed", errorCode: "render_failed" }]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][0], "video_render_failed");
  assert.equal(calls[1][1].error_code, "render_failed");
  assert.equal(JSON.stringify(calls).includes("historical"), false);
});

test("existing internal event writes are preserved and do not gate direct tracking", async () => {
  const calls = [], writes = [];
  const client = load("app/components/video-event-client.ts", {
    fetch: async (...args) => { writes.push(args); throw new Error("offline"); },
  }, {
    "@/lib/analytics": { trackEvent: (...args) => calls.push(args) },
    "@/lib/video-workspace/analytics-contract": contract,
  });
  client.trackVideoWorkspaceEvent("internal-project", {
    eventName: "edit_saved", eventKey: "existing-key", candidateId: "internal-candidate",
    properties: { elapsedMs: 500, revision: 2, segmentCount: 1 },
  });
  await Promise.resolve();
  assert.deepEqual(plain(calls), [["video_edit_saved", { elapsed_ms: 500 }]]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "/api/video-projects/internal-project/events");
  assert.equal(writes[0][1].method, "POST");
  assert.equal(JSON.parse(writes[0][1].body).eventKey, "existing-key");
});
