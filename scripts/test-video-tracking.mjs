import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function load(path, globals = {}, imports = {}) {
  const output = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
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

test("non-video events reach all sinks; GA excludes payment IDs and raw error text", () => {
  const h = analyticsHarness();
  h.trackEvent("checkout_fail", { tier: "pro", transaction_id: "PRIVATE", error_message: "PRIVATE", error_code: "failed", stage: "checkout" });
  assert.equal(h.old.length, 1);
  assert.equal(h.ga.length, 1);
  assert.equal(h.ga[0][1], "checkout_fail");
  assert.equal(h.ga[0][2].transaction_id, undefined);
  assert.equal(h.ga[0][2].error_message, undefined);
});

test("script readiness buffering delivers each sink once, expires and remains bounded", () => {
  let now = 0;
  const window = { location: { href: "https://scribix.io/" } };
  const timers = new Map(); let nextTimer = 0;
  const analytics = load("lib/analytics.ts", {
    window, Date: { now: () => now },
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: id => timers.delete(id),
  }, { "./video-workspace/analytics-contract": contract });
  analytics.trackEvent("signin_success", { method: "google" });
  const plausible = [], ga = [], clarity = [];
  window.plausible = (...args) => plausible.push(args);
  analytics.flushAnalyticsBuffer();
  assert.equal(plausible.length, 1);
  window.gtag = (...args) => ga.push(args);
  window.clarity = (...args) => clarity.push(args);
  analytics.flushAnalyticsBuffer();
  analytics.flushAnalyticsBuffer();
  assert.equal(plausible.length, 1);
  assert.equal(ga.length, 1);
  assert.equal(clarity.filter(args => args[0] === "event").length, 1);
  assert.equal(timers.size, 0);
  delete window.plausible;
  analytics.trackEvent("tool_visit", { tool_slug: "expired" });
  now = 30_001;
  window.plausible = (...args) => plausible.push(args);
  analytics.flushAnalyticsBuffer();
  assert.equal(plausible.length, 1);
  delete window.plausible;
  for (let i = 0; i < 150; i++) analytics.trackEvent("tool_visit", { tool_slug: String(i) });
  window.plausible = (...args) => plausible.push(args);
  analytics.flushAnalyticsBuffer();
  assert.equal(plausible.length, 101);
});

test("candidate observer covers accepted asynchronous, empty, failure, retry and restored active results", () => {
  const calls = [];
  const client = load("app/components/video-event-client.ts", {}, {
    "@/lib/analytics": { trackEvent: (...args) => calls.push(args) },
    "@/lib/video-workspace/analytics-contract": contract,
  });
  const observer = client.createCandidateResultObserver();
  const snapshot = (id, status) => ({ task: { requestId: id, status }, status });
  observer.observe(snapshot("historical", "candidates_ready"));
  assert.equal(calls.length, 0);
  observer.watch("new");
  observer.observe(snapshot("new", "analyzing"));
  observer.observe(snapshot("other", "candidates_ready"));
  observer.observe({ ...snapshot("new", "candidates_ready"), candidates: [] });
  observer.observe(snapshot("new", "analyzing")); // Late poll cannot re-arm a settled task.
  observer.observe(snapshot("new", "candidates_ready"));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "video_candidates_completed");
  observer.watch("retry");
  observer.observe(snapshot("retry", "failed"));
  observer.begin("retry");
  observer.observe(snapshot("retry", "failed")); // Stale pre-acceptance poll.
  observer.accept("retry");
  observer.observe(snapshot("retry", "analyzing"));
  observer.observe(snapshot("retry", "candidates_ready"));
  assert.deepEqual(calls.map(call => call[0]), ["video_candidates_completed", "video_candidates_failed", "video_candidates_completed"]);
  const restored = client.createCandidateResultObserver();
  restored.observe(snapshot("restored", "waiting"));
  restored.observe(snapshot("restored", "editing"));
  assert.equal(calls.at(-1)[0], "video_manual_clip_ready");
  assert.equal(JSON.stringify(calls).includes("requestId"), false);
});

test("sign-in confirmation retries failures, consumes once and fences newer pending attempts", async () => {
  const values = new Map(), calls = [];
  let response = async () => ({ ok: false });
  const signin = load("lib/signin-tracking.ts", {
    sessionStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    fetch: () => response(),
  }, { "./analytics": { trackEvent: (...args) => calls.push(args) } });
  signin.markSignInPending("google-onetap");
  assert.equal(await signin.observePendingSignIn(), false);
  response = async () => ({ ok: true, json: async () => ({}) });
  assert.equal(await signin.observePendingSignIn(), false);
  response = async () => ({ ok: true, json: async () => ({ user: { id: "verified" } }) });
  await signin.observePendingSignIn();
  await signin.observePendingSignIn();
  assert.deepEqual(plain(calls), [["signin_success", { method: "google-onetap" }]]);
  signin.markSignInPending();
  let resolve;
  response = () => new Promise(done => { resolve = done; });
  const pending = signin.observePendingSignIn();
  signin.markSignInPending();
  resolve({ ok: true, json: async () => ({ user: { id: "old-session" } }) });
  await pending;
  assert.equal(calls.length, 1);
  assert.equal(values.size, 1);
});

// Execute the production component handlers with hook state and mocked HTTP/collectors.
function componentHarness() {
  const slots = [], effects = [];
  let index = 0;
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
    useMemo(fn) { return fn(); },
    useEffect(fn) { effects.push(fn); },
  };
  const jsx = (type, props) => ({ type, props });
  return { react, effects, jsx: { jsx, jsxs: jsx }, render(fn) { index = 0; effects.length = 0; return fn(); } };
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const drain = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test("YouTube inspect and import handlers send success to real analytics only after valid responses", async () => {
  const h = componentHarness(), analytics = analyticsHarness(), routes = [], requests = [];
  let failImport = true;
  const { YouTubeImporter } = load("app/components/YouTubeImporter.tsx", {
    fetch: async url => {
      requests.push(url);
      return { ok: true, json: async () => url.endsWith("/import")
        ? (failImport ? {} : { transcriptId: "private-transcript" })
        : { videoId: "private-video", tracks: [{ id: "en", languageCode: "en", languageName: "English" }] } };
    },
  }, {
    react: h.react, "react/jsx-runtime": h.jsx, "next/navigation": { useRouter: () => ({ push: url => routes.push(url) }) },
    "lucide-react": {}, "next-intl": { useTranslations: () => key => key },
    "@/lib/plans": { youtubeImportsFor: () => 3, youtubeMaxVideoSecFor: () => 3600 },
    "@/lib/analytics": analytics, "./LoginModal": { useLoginModal: () => ({ openLogin() {} }) },
  });
  const render = () => h.render(() => YouTubeImporter({ signedIn: true, postSignInPath: "/youtube-to-transcript", toolSlug: "youtube-to-transcript" }));
  let tree = render();
  nodes(tree).find(node => node.type === "input").props.onChange({ target: { value: "https://youtube.com/watch?v=test" } });
  tree = render();
  nodes(tree).find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  await drain();
  tree = render();
  nodes(tree).find(node => node.type === "button" && node.props.onClick).props.onClick();
  await drain();
  assert.equal(routes.length, 0);
  assert.equal(analytics.old.at(-1)[0], "youtube_import_fail");
  failImport = false;
  tree = render();
  nodes(tree).find(node => node.type === "button" && node.props.onClick).props.onClick();
  await drain();
  assert.deepEqual(analytics.old.map(call => call[0]), ["youtube_inspect_attempt", "youtube_inspect_success", "youtube_import_attempt", "youtube_import_fail", "youtube_import_attempt", "youtube_import_success"]);
  assert.equal(routes.length, 1);
  assert.equal(requests.length, 3);
  assert.equal(JSON.stringify(analytics.ga).includes("private-transcript"), false);
  assert.equal(analytics.ga.filter(call => call[1] === "youtube_import_success").length, 1);
});

test("actual candidate polling forwards active-to-terminal snapshots to the collectors once", async () => {
  const h = componentHarness(), analytics = analyticsHarness(), intervals = [];
  const client = load("app/components/video-event-client.ts", {}, {
    "@/lib/analytics": analytics, "@/lib/video-workspace/analytics-contract": contract,
  });
  let snapshot = { status: "analyzing", task: { requestId: "private-request", status: "running", range: { startMs: 0, endMs: 60000 } }, transcriptReady: true, candidates: [], previews: [] };
  const imports = {
    react: h.react, "react/jsx-runtime": h.jsx, "lucide-react": {},
    "next-intl": { useTranslations: () => key => key }, "./video-event-client": client,
    "@/lib/video-workspace/contracts": { VIDEO_WORKSPACE_LIMITS: { directEditMaxSourceDurationMs: 90000 } },
    "@/lib/video-workspace/analysis-config": { AI_ANALYSIS: { maxRangeMs: 100000 } },
    "@/lib/video-workspace/selection": { DEFAULT_SELECTION: {} },
  };
  // Child UI components are not mounted; all other component imports are display-only here.
  const dependencies = new Proxy(imports, { has: () => true, get: (target, key) => target[key] ?? {} });
  const { VideoCandidateWorkspace } = load("app/components/VideoCandidateWorkspace.tsx", {
    URLSearchParams,
    window: { location: { search: "" }, setInterval: fn => { intervals.push(fn); return intervals.length; }, clearInterval() {} },
    fetch: async () => ({ ok: true, json: async () => snapshot }),
  }, dependencies);
  const props = { projectId: "private-project", initialStatus: "analyzing", sourceDurationMs: 600000, initialCandidates: [], initialPreviews: [], initialRenders: [], sourceAvailable: true, canEdit: true };
  h.render(() => { const child = VideoCandidateWorkspace(props).props.children; return child.type(child.props); });
  h.effects.forEach(effect => effect());
  await drain();
  assert.equal(intervals.length, 1);
  snapshot = { ...snapshot, status: "candidates_ready", task: { ...snapshot.task, status: "completed" } };
  await intervals[0]();
  await intervals[0]();
  assert.equal(analytics.requests.length, 1);
  assert.equal(JSON.parse(analytics.requests[0][1].body).n, "video_candidates_completed");
  assert.equal(JSON.stringify(analytics.requests).includes("private-request"), false);
});

test("delayed Plausible event preserves its origin page across navigation", () => {
  const sent = [], window = { location: { href: "https://scribix.io/audio-to-text" }, localStorage: { getItem: () => null }, gtag() {}, clarity() {} };
  const analytics = load("lib/analytics.ts", {
    window, URL, setTimeout: () => 1, clearTimeout() {},
    fetch: async (...args) => { sent.push(args); return { ok: true }; },
  }, { "./video-workspace/analytics-contract": contract });
  analytics.trackEvent("tool_visit", { tool_slug: "audio-to-text" });
  window.location.href = "https://scribix.io/dashboard";
  window.plausible = () => assert.fail("legacy script would use the wrong page");
  analytics.flushAnalyticsBuffer();
  analytics.flushAnalyticsBuffer();
  assert.equal(sent.length, 1);
  assert.equal(JSON.parse(sent[0][1].body).u, "https://scribix.io/audio-to-text");
});

for (const conflict of [false, true]) {
  test(conflict ? "candidate conflict resumes observation of the server task" : "retry ignores a pre-acceptance GET that returns after the POST", async () => {
    const h = componentHarness(), calls = [], intervals = [];
    const client = load("app/components/video-event-client.ts", {}, {
      "@/lib/analytics": { trackEvent: (...args) => calls.push(args) },
      "@/lib/video-workspace/analytics-contract": contract,
    });
    const task = { requestId: "server-request", status: "failed", canRetry: true, steps: [], range: { startMs: 0, endMs: 60000 } };
    let snapshot = { status: "failed", task: conflict ? null : task, transcriptReady: true, candidates: [], previews: [] };
    let resolvePost, resolvePoll, delayPoll = false;
    const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
    const imports = {
      react: h.react, "react/jsx-runtime": h.jsx, "lucide-react": {},
      "next-intl": { useTranslations: () => key => key }, "./video-event-client": client,
      "@/lib/video-workspace/contracts": { VIDEO_WORKSPACE_LIMITS: { directEditMaxSourceDurationMs: 90000 } },
      "@/lib/video-workspace/analysis-config": { AI_ANALYSIS: { maxRangeMs: 100000 } },
      "@/lib/video-workspace/selection": { DEFAULT_SELECTION: {} },
    };
    const { VideoCandidateWorkspace } = load("app/components/VideoCandidateWorkspace.tsx", {
      URLSearchParams,
      window: { location: { search: "" }, setInterval: fn => { intervals.push(fn); return intervals.length; }, clearInterval() {} },
      fetch: async (_url, options) => {
        if (options?.method === "POST") return new Promise(resolve => { resolvePost = resolve; });
        if (delayPoll) { delayPoll = false; return new Promise(resolve => { resolvePoll = resolve; }); }
        return response(snapshot);
      },
    }, new Proxy(imports, { has: () => true, get: (target, key) => target[key] ?? {} }));
    const props = { projectId: "project", initialStatus: "failed", sourceDurationMs: 600000, initialCandidates: [], initialPreviews: [], initialRenders: [], sourceAvailable: true, canEdit: true };
    const render = () => h.render(() => { const child = VideoCandidateWorkspace(props).props.children; return child.type(child.props); });
    render();
    h.effects.forEach(effect => effect());
    await drain();
    nodes(render()).find(node => node.props?.onStart).props.onStart();
    render();
    h.effects.forEach(effect => effect());
    await drain();
    delayPoll = true;
    const stalePoll = intervals.at(-1)();
    const staleSnapshot = snapshot;
    snapshot = { ...snapshot, status: "analyzing", task: { ...task, status: "running", canRetry: false } };
    resolvePost(conflict ? response({ error: "candidate_generation_active" }, 409) : response(snapshot, 202));
    await drain();
    resolvePoll(response(staleSnapshot));
    await stalePoll;
    await intervals.at(-1)();
    snapshot = { ...snapshot, status: "candidates_ready", task: { ...task, status: "completed", canRetry: false } };
    await intervals.at(-1)();
    await intervals.at(-1)();
    assert.deepEqual(calls.map(call => call[0]), ["video_candidates_started", "video_candidates_completed"]);
  });
}
