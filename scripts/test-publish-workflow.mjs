import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { titleLayout } from "../containers/video-preview/title-layout.mjs";
import { titleAssEvents } from "../containers/video-preview/final-render.mjs";
const root = resolve(import.meta.dirname, "..");
function loadModule(path, mocks = {}, globals = {}, cache = new Map()) {
  const key = resolve(root, path);
  if (cache.has(key)) return cache.get(key);
  const module = { exports: {} }; cache.set(key, module.exports);
  const compiled = ts.transpileModule(readFileSync(key, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, Response, Request, Headers, URL, TextEncoder, crypto: globalThis.crypto,
    console: { info() {}, error() {} }, process: { env: {} }, ...globals,
    require(name) {
      if (name in mocks) return mocks[name];
      const target = name.startsWith("@/") ? resolve(root, name.slice(2)) : resolve(dirname(key), name);
      return loadModule(`${target}.ts`, mocks, globals, cache);
    },
  }, { filename: key });
  return module.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const selection = loadModule("lib/video-workspace/selection.ts");
const publishing = loadModule("lib/video-workspace/publish.ts");
test("selection defaults, Unicode limit and strict types", () => {
  assert.deepEqual(plain(selection.parseSelection(undefined)), { mode: "auto", topic: "", kind: "any" });
  assert.equal(selection.parseSelection({ mode: "specific", topic: "😀".repeat(300), kind: "story" }).topic.length, 600);
  for (const value of [null, {}, { mode: "specific", topic: "😀".repeat(301), kind: "any" }, { mode: "specific", topic: [], kind: "any" }, { mode: "specific", topic: "x", kind: "speaker" }]) assert.throws(() => selection.parseSelection(value));
});
const edl = { schemaVersion: 1, segments: [{ id: "s0", sourceStartMs: 1000, sourceEndMs: 3000, order: 0 }] };
const spec = { captions: { cues: [{ segmentId: "s0", words: [
  { text: "excluded", sourceStartMs: 0, sourceEndMs: 500 },
  { text: "corrected", sourceStartMs: 1000, sourceEndMs: 2000 },
  { text: "speech", sourceStartMs: 2000, sourceEndMs: 3000 },
  { text: "excluded", sourceStartMs: 3000, sourceEndMs: 4000 },
] }] } };
const generated = { titles: ["One", "Two", "Three"], title: "Post", body: "Supported speech.", tags: ["speech"] };
test("publish input contains only retained corrected speech; visual edits do not stale copy", () => {
  assert.equal(publishing.publishContent(edl, spec), "corrected speech");
  assert.equal(publishing.publishContentKey(edl, spec), publishing.publishContentKey(edl, { ...spec, coverTimelineMs: 2, openingTitle: { text: "new" } }));
  assert.notEqual(publishing.publishContentKey(edl, spec), publishing.publishContentKey({ ...edl, segments: [{ ...edl.segments[0], sourceEndMs: 2500 }] }, spec));
});
test("regeneration retains manual fields and stale warning; independent clips do not share copy", () => {
  const first = publishing.mergePublishDraft(null, generated, "old", "all");
  first.body = "My hand-written post"; first.edited.body = true;
  const next = publishing.mergePublishDraft(first, { ...generated, title: "New", body: "Automatic" }, "new", "copy");
  assert.equal(next.body, first.body); assert.equal(next.title, "New"); assert.equal(next.contentKey, "old");
  assert.equal(publishing.mergePublishDraft(null, generated, "new", "all").body, generated.body);
  assert.match(publishing.publishText(first), /My hand-written post\n\n#speech/);
  assert.throws(() => publishing.parsePublishDraft({ ...first, tags: Array(6).fill("tag") }));
});
test("cover stays on the same source frame after trim, or explicitly falls back", () => {
  assert.deepEqual(plain(publishing.remapCoverFrame(edl, { ...edl, segments: [{ ...edl.segments[0], sourceStartMs: 1500 }] }, 1000)), { timelineMs: 500, removed: false });
  assert.deepEqual(plain(publishing.remapCoverFrame(edl, { ...edl, segments: [{ ...edl.segments[0], sourceEndMs: 1800 }] }, 1000)), { timelineMs: 0, removed: true });
});
test("shared title layout supports Unicode, safe subtitle separation and escaped ASS", () => {
  for (const text of ["A long title with useful advice ".repeat(4).slice(0, 120), "起業に失敗して学んだこと".repeat(10).slice(0, 120), "Überraschende Erfahrungen à partager"]) {
    const overlay = { enabled: true, text, fontScale: 1.5, positionY: 0.78, color: "#FFFFFF", durationMs: 3000 };
    const layout = titleLayout(overlay, 0.78);
    assert.ok(layout.lines.length <= 5); assert.ok(Math.abs(layout.positionY - 0.78) >= 0.2);
    assert.equal(layout.lines.join("").replaceAll(" ", ""), text.trim().replaceAll(" ", ""));
    assert.equal(titleAssEvents(overlay).length, layout.lines.length);
    assert.ok(titleAssEvents(overlay).every(line => line.includes("0:00:03.00") && line.includes("Noto Sans JP")));
  }
  assert.ok(!titleAssEvents({ enabled: true, text: "{\\pos(1,1)}", color: "#FFFFFF", durationMs: 3000 }).join("").includes("{\\pos(1,1)}"));
});

function database() {
  const dir = mkdtempSync(join(tmpdir(), "scribix-selection-test-")); const path = join(dir, "db.sqlite");
  const migrations = readdirSync(join(root, "migrations")).filter(x => x.endsWith(".sql")).sort().map(x => readFileSync(join(root, "migrations", x), "utf8")).join("\n");
  execFileSync("python3", ["-c", "import sqlite3,sys; sqlite3.connect(sys.argv[1]).executescript(sys.stdin.read())", path], { input: migrations });
  function run(statements) {
    return JSON.parse(execFileSync("python3", ["-c", `import sqlite3,sys,json
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
out=[]
with c:
 for q in json.load(sys.stdin):
  cursor=c.execute(q['sql'],q.get('values',[])); rows=[dict(r) for r in cursor.fetchall()] if cursor.description else []
  out.append({'results':rows,'meta':{'changes':max(0,cursor.rowcount)}})
print(json.dumps(out))`, path], { input: JSON.stringify(statements), encoding: "utf8" }));
  }
  const db = { prepare(sql) { return { sql, values: [], bind(...values) { this.values = values; return this; }, async run() { return run([this])[0]; }, async first() { return run([this])[0].results[0] ?? null; }, async all() { return run([this])[0]; } }; }, async batch(statements) { return run(statements); } };
  run([{ sql: `INSERT INTO users(id,email,period_ends_at) VALUES ('u','fixture@example.test','2099-01-01')` }, { sql: `INSERT INTO transcripts(id,user_id,title,status,source,speech_model,webhook_token,transcript_r2_key) VALUES ('t','u','Test','completed','upload','test','test','transcript.json')` }, { sql: `INSERT INTO video_projects(id,user_id,transcript_id) VALUES ('p','u','t')` }, { sql: `INSERT INTO media_assets(id,user_id,project_id,kind,status,mime_type,duration_ms) VALUES ('a','u','p','source','ready','video/mp4',180000)` }, { sql: `UPDATE video_projects SET source_asset_id='a' WHERE id='p'` }]);
  return { db, run, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}
function routeFixture(t) {
  const databaseFixture = database(); t.after(databaseFixture.dispose);
  const { db } = databaseFixture;
  const calls = []; let generate = async () => ({ candidates: { candidates: [] }, usage: null });
  class ProviderError extends Error { constructor(code) { super(code); this.providerCode = code; } }
  const provider = { OPENAI_CANDIDATE_MODEL: "test", OpenAICandidateError: ProviderError,
    async generateCandidatesWithOpenAI(analysis, options) { calls.push(options.requirements); return generate(analysis, options); },
    async reviewCandidatesWithOpenAI(_analysis, proposed, options) { calls.push(options.requirements); return { candidates: proposed, reviews: [], usage: null }; },
  };
  const env = { DB: db, SCRIBIX_MEDIA: { async get() { return { async json() { return { words: Array.from({ length: 180 }, (_, i) => ({ text: i % 10 === 9 ? "speech." : "speech", start: i*1000, end: i*1000+900 })) }; } }; } } };
  const user = { id: "u", tier: "free" };
  const route = loadModule("app/api/video-projects/[id]/candidates/route.ts", {
    "@/auth": { auth: async () => ({ user: { id: "u" } }) }, "@/lib/cf": { cf: async () => env },
    "@/lib/current-user": { getOrCreateCurrentUser: async () => user },
    "@/lib/openai-candidates": provider,
    "@/lib/video-workspace/render-scheduling": { recoverProjectRenderQueue: async () => {} },
    "@/lib/video-workspace/preview-jobs": { listCandidatePreviews: async () => [], queueAutomaticCandidatePreviews: async () => {}, queueCandidatePreviews: async () => {} },
  });
  const params = { params: Promise.resolve({ id: "p" }) };
  return { ...databaseFixture, env, calls, user, ProviderError, generate(fn) { generate = fn; }, post: body => route.POST(new Request("http://local/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), params), get: () => route.GET(new Request("http://local/api"), params) };
}
test("zero matches grants exactly one explicit direction change; unchanged retries do not spend it", async t => {
  const f = routeFixture(t);
  let response = await f.post({}); assert.equal(response.status, 200);
  let body = await response.json(); assert.equal(body.selection.outcome, "empty"); assert.equal(body.selection.adjustmentsRemaining, 1);
  await f.post({}); assert.equal(f.calls.length, 2);
  response = await f.post({ adjust: true, requirements: { mode: "specific", topic: "story", kind: "story" } });
  body = await response.json(); assert.equal(body.selection.adjustmentsRemaining, 0); assert.equal(body.selection.requirements.kind, "story");
  assert.equal((await f.post({ adjust: true })).status, 409);
});
test("technical failure retries original direction; unsupported search releases direction", async t => {
  const f = routeFixture(t); f.generate(async () => { throw new Error("network"); });
  assert.equal((await f.post({ requirements: { mode: "specific", topic: "original", kind: "advice" } })).status, 502);
  f.generate(async () => ({ candidates: { candidates: [] }, usage: null }));
  const body = await (await f.post({ requirements: { mode: "specific", topic: "changed", kind: "story" } })).json();
  assert.equal(body.selection.requirements.topic, "original"); assert.equal(body.selection.adjustmentsRemaining, 1);
  f.generate(async () => { throw new f.ProviderError("unsupported_selection"); });
  assert.equal((await f.post({ adjust: true, requirements: { mode: "specific", topic: "add music", kind: "any" } })).status, 422);
  const current = await (await f.get()).json(); assert.equal(current.selection.outcome, "empty"); assert.equal(current.selection.adjustmentsRemaining, 1);
});
test("pending transcription persists intent and does not call the model", async t => {
  const f = routeFixture(t); f.run([{ sql: "UPDATE transcripts SET status='processing'" }]);
  let body = await (await f.post({ requirements: { mode: "specific", topic: "saved", kind: "qa" } })).json();
  assert.equal(body.selection.outcome, "waiting"); assert.equal(f.calls.length, 0);
  f.run([{ sql: "UPDATE transcripts SET status='completed'" }]);
  body = await (await f.post({})).json(); assert.equal(body.selection.requirements.topic, "saved");
});
test("concurrent tabs and late old execution cannot overwrite current results", async t => {
  const f = routeFixture(t); let resolveFirst; let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  f.generate(async () => { started(); return new Promise(resolve => { resolveFirst = resolve; }); });
  const first = f.post({ requestId: "first-request" }); await Promise.race([startedPromise, first.then(async response => { throw new Error(`generation did not start: ${response.status} ${await response.text()}`); })]);
  assert.equal((await f.post({ requestId: "other-request" })).status, 409);
  f.run([{ sql: "UPDATE video_projects SET updated_at=datetime('now','-11 minutes')" }]);
  f.generate(async () => ({ candidates: { candidates: [{ theme: "New", hook: "New", reason: "Complete", score: 0.9, segments: [{ startMs: 0, endMs: 29900 }] }] }, usage: null }));
  const next = await (await f.post({ requestId: "new-request" })).json(); assert.equal(next.candidates.length, 1);
  resolveFirst({ candidates: { candidates: [] }, usage: null }); await first;
  const current = await (await f.get()).json(); assert.equal(current.candidates.length, 1); assert.equal(current.selection.requestId, "new-request");
  assert.equal((await f.post({ adjust: true })).status, 409);
});

function publishFixture(t) {
  const f = database(); t.after(f.dispose);
  const user = { id: "u", tier: "pro" };
  let preview = null;
  const mocks = {
    "@/lib/r2": { presignGet: async () => "https://example.test/source" },
    "./asset-access": { presignOwnedAssetGet: async () => ({ ok: false }) },
    "./brand-assets": { listBrandAssets: async () => [] },
    "./preview-jobs": { candidatePreview: async () => preview },
  };
  const editor = loadModule("lib/video-workspace/editor.ts", mocks);
  const clipEdl = { schemaVersion: 1, segments: [{ id: "s0", sourceStartMs: 0, sourceEndMs: 29900, order: 0 }] };
  const words = Array.from({ length: 30 }, (_, i) => ({ text: `word${i}`, startMs: i*1000, endMs: i*1000+900, speaker: null }));
  const renderSpec = editor.defaultRenderSpec(clipEdl, words);
  f.run([{ sql: `INSERT INTO clip_candidates(id,user_id,project_id,rank,theme,hook,reason,score,segments_json) VALUES ('c','u','p',0,'Clip','Opening','Complete',0.9,?)`, values: [JSON.stringify([{ startMs: 0, endMs: 29900 }])] }]);
  const bucket = { async get() { return { async json() { return { words: words.map(w => ({ text: w.text, start: w.startMs, end: w.endMs })) }; } }; } };
  let provider = async () => ({ parsed: generated, usage: null }); let calls = 0;
  const route = loadModule("app/api/video-projects/[id]/publish/route.ts", {
    "@/auth": { auth: async () => ({ user: { id: user.id } }) }, "@/lib/cf": { cf: async () => ({ DB: f.db, SCRIBIX_MEDIA: bucket }) },
    "@/lib/current-user": { getOrCreateCurrentUser: async () => user }, "@/lib/video-workspace/editor": editor,
    "@/lib/openai-candidates": { OPENAI_CANDIDATE_MODEL: "test", OpenAICandidateError: class extends Error {} },
    "@/lib/openai-publish": { generatePublishMaterials: async (input, requestId) => { calls++; return provider({ input, requestId }); } },
  });
  const post = body => route.POST(new Request("http://local/api", { method: "POST", body: JSON.stringify({ candidateId: "c", expectedRevision: 1, ...body }) }), { params: Promise.resolve({ id: "p" }) });
  return { ...f, setPreview: value => { preview = value; }, user, editor, clipEdl, renderSpec, bucket, post, calls: () => calls, provider: fn => { provider = fn; }, save: () => editor.saveProjectDraft(f.db, "u", "p", "c", 0, clipEdl, renderSpec) };
}
test("publishing saves all materials and reopens without another model call; free is denied", async t => {
  const f = publishFixture(t); assert.equal((await f.save()).ok, true);
  const response = await f.post({}); assert.equal(response.status, 200);
  const workspace = await response.json(); assert.equal(workspace.renderSpec.openingTitle.text, "One"); assert.equal(workspace.renderSpec.coverTitle.text, "One"); assert.equal(workspace.renderSpec.openingTitle.durationMs, 3000);
  assert.equal((await f.post({ expectedRevision: 2 })).status, 200); assert.equal(f.calls(), 1);
  f.user.tier = "free"; assert.equal((await f.post({ expectedRevision: 2 })).status, 402); assert.equal(f.calls(), 1);
});
test("saved manual text survives suggestion regeneration, with independent cover text", async t => {
  const f = publishFixture(t); await f.save();
  const workspace = await (await f.post({})).json();
  workspace.publishDraft.title = "My title"; workspace.publishDraft.edited.title = true;
  workspace.publishDraft.edited.cover = true; workspace.renderSpec.coverTitle.text = "My cover";
  const saved = await f.editor.saveProjectDraft(f.db, "u", "p", "c", 2, workspace.edl, workspace.renderSpec, workspace.publishDraft); assert.equal(saved.ok, true);
  f.provider(async () => ({ parsed: { ...generated, title: "New generated title", titles: ["New opening", "Second", "Third"] }, usage: null }));
  const next = await (await f.post({ expectedRevision: 3, mode: "titles" })).json();
  assert.equal(next.publishDraft.title, "My title"); assert.equal(next.renderSpec.coverTitle.text, "My cover"); assert.equal(next.renderSpec.openingTitle.text, "New opening");
});
test("draft changes during generation fail CAS without losing the user's saved content", async t => {
  const f = publishFixture(t); await f.save(); let release; let started;
  const begin = new Promise(resolve => { started = resolve; });
  f.provider(async () => { started(); return new Promise(resolve => { release = resolve; }); });
  const pending = f.post({}); await begin;
  assert.equal((await f.post({})).status, 429);
  const changed = { ...f.renderSpec, coverTimelineMs: 1500 };
  assert.equal((await f.editor.saveProjectDraft(f.db, "u", "p", "c", 1, f.clipEdl, changed)).ok, true);
  release({ parsed: generated, usage: null }); assert.equal((await pending).status, 409);
  const row = await f.db.prepare("SELECT draft_revision, draft_render_spec_json, publish_draft_json FROM clip_candidates WHERE id='c'").first();
  assert.equal(row.draft_revision, 2); assert.equal(JSON.parse(row.draft_render_spec_json).coverTimelineMs, 1500); assert.equal(row.publish_draft_json, null);
});
test("per-user generation rate limit survives repeat calls and preserves existing materials", async t => {
  const f = publishFixture(t); await f.save();
  let revision = 1;
  for (let i = 0; i < 5; i++) { const r = await f.post({ expectedRevision: revision, mode: i ? "copy" : "all" }); assert.equal(r.status, 200); revision = (await r.json()).revision; }
  assert.equal((await f.post({ expectedRevision: revision, mode: "copy" })).status, 429);
  assert.equal(f.calls(), 5);
});
test("immutable project version keeps original publish copy after the draft changes", async t => {
  const f = publishFixture(t); await f.save(); const workspace = await (await f.post({})).json();
  const snapshot = await f.editor.snapshotProjectDraft(f.db, "u", "p", "c", 2); assert.equal(snapshot.ok, true);
  workspace.publishDraft.body = "Changed later"; workspace.publishDraft.edited.body = true;
  await f.editor.saveProjectDraft(f.db, "u", "p", "c", 2, workspace.edl, workspace.renderSpec, workspace.publishDraft);
  const row = await f.db.prepare("SELECT publish_draft_json FROM project_versions WHERE id=?1").bind(snapshot.projectVersionId).first();
  assert.equal(JSON.parse(row.publish_draft_json).body, generated.body);
});

async function renderFixture(t) {
  const f = publishFixture(t); await f.save(); const workspace = await (await f.post({})).json();
  const snapshot = await f.editor.snapshotProjectDraft(f.db, "u", "p", "c", workspace.revision);
  f.run([{ sql: `INSERT INTO media_assets(id,user_id,project_id,kind,status,mime_type,r2_key) VALUES ('video','u','p','final_video','pending','video/mp4','video.mp4'),('cover','u','p','cover','pending','image/jpeg','cover.jpg')` }, { sql: `INSERT INTO render_jobs(id,user_id,project_id,project_version_id,kind,preset_id,status,idempotency_key,output_asset_id,cover_asset_id) VALUES ('job','u','p',?,'final','vertical-1080p-v1','running','test-final-job','video','cover')`, values: [snapshot.projectVersionId] }]);
  const internal = loadModule("lib/video-workspace/final-internal-jobs.ts", {
    "@/lib/r2": { presignGet: async key => `https://fixture.test/${key}`, presignPut: async key => `https://fixture.test/${key}` },
    "./events": { recordServerRenderEvent: async () => {} },
  });
  const videoOutput = { bytes: 100, durationMs: 29900, width: 1080, height: 1920, videoCodec: "h264", audioCodec: "aac" };
  return { ...f, workspace, snapshot, internal, videoOutput };
}
test("partial video completion survives cover failure and lease reuses the completed video", async t => {
  const f = await renderFixture(t);
  const bucket = { head: async () => ({ size: 100 }) };
  assert.equal(await f.internal.recordFinalAsset(f.db, bucket, "job", { kind: "video", output: f.videoOutput }), true);
  await f.internal.recordFinalJobResult(f.db, bucket, "job", { status: "failed", errorCode: "render_failed" });
  const statuses = f.run([{ sql: "SELECT id,status FROM media_assets WHERE id IN ('video','cover') ORDER BY id" }])[0].results;
  assert.deepEqual(statuses, [{ id: "cover", status: "failed" }, { id: "video", status: "ready" }]);
  f.run([{ sql: "UPDATE render_jobs SET status='preparing' WHERE id='job'" }, { sql: "UPDATE media_assets SET status='pending' WHERE id='cover'" }, { sql: "UPDATE media_assets SET r2_key='source.mp4' WHERE id='a'" }]);
  const lease = await f.internal.leaseFinalJob(f.db, "job"); assert.equal(lease.ok, true); assert.equal(lease.lease.reusableVideoUrl, "https://fixture.test/video.mp4");
  assert.equal(lease.lease.reusableCoverUrl, undefined);
});
test("asset callback rejects invalid sizes and canceled jobs", async t => {
  const f = await renderFixture(t);
  assert.equal(await f.internal.recordFinalAsset(f.db, { head: async () => ({ size: 99 }) }, "job", { kind: "video", output: f.videoOutput }), false);
  f.run([{ sql: "UPDATE render_jobs SET status='canceled' WHERE id='job'" }]);
  assert.equal(await f.internal.recordFinalAsset(f.db, { head: async () => ({ size: 100 }) }, "job", { kind: "video", output: f.videoOutput }), false);
});
test("download package captures current copy without rerendering, then ignores later edits", async t => {
  const f = await renderFixture(t);
  f.run([{ sql: "UPDATE render_jobs SET status='completed' WHERE id='job'" }, { sql: "UPDATE media_assets SET status='ready' WHERE id IN ('video','cover')" }]);
  const archiveInputs = [];
  const route = loadModule("app/api/video-projects/[id]/renders/[jobId]/download/route.ts", {
    "@/auth": { auth: async () => ({ user: { id: "u" } }) }, "@/lib/cf": { cf: async () => ({ DB: f.db, SCRIBIX_MEDIA: { get: async () => ({ body: new Blob(["media"]).stream() }) } }) },
    "@/lib/current-user": { getOrCreateCurrentUser: async () => f.user },
    "@/lib/video-workspace/export-archive": { exportFileName: () => "clip", attachmentHeader: () => "attachment", exportArchive(entries) { archiveInputs.push(entries); return new Blob(["zip"]).stream(); } },
  }, { Blob });
  const params = { params: Promise.resolve({ id: "p", jobId: "job" }) };
  f.workspace.publishDraft.body = "Copy selected for download";
  await f.editor.saveProjectDraft(f.db, "u", "p", "c", 2, f.workspace.edl, f.workspace.renderSpec, f.workspace.publishDraft);
  let response = await route.POST(new Request("http://local/download", { method: "POST", body: JSON.stringify({ expectedRevision: 3 }) }), params); assert.equal(response.status, 200);
  const packageUrl = (await response.json()).url;
  f.workspace.publishDraft.body = "Changed while downloading";
  await f.editor.saveProjectDraft(f.db, "u", "p", "c", 3, f.workspace.edl, f.workspace.renderSpec, f.workspace.publishDraft);
  response = await route.GET(new Request(`http://local${packageUrl}`), params); assert.equal(response.status, 200);
  assert.equal(archiveInputs[0].length, 3);
  const copy = await new Response(archiveInputs[0][2].body).text(); assert.ok(copy.includes("Copy selected for download")); assert.ok(!copy.includes("Changed while downloading"));
  assert.equal((await route.POST(new Request("http://local/download", { method: "POST", body: JSON.stringify({ expectedRevision: 3 }) }), params)).status, 409);
});

test("expired generation execution cannot commit even if the draft revision is unchanged", async t => {
  const f = publishFixture(t); await f.save(); let release, started;
  const begin = new Promise(resolve => { started = resolve; });
  f.provider(async () => { started(); return new Promise(resolve => { release = resolve; }); });
  const pending = f.post({}); await begin;
  f.run([{ sql: "UPDATE publish_generation_limits SET execution_id='new-execution', lease_until=unixepoch()+180" }]);
  release({ parsed: generated, usage: null }); assert.equal((await pending).status, 409);
  const row = await f.db.prepare("SELECT draft_revision,publish_draft_json FROM clip_candidates WHERE id='c'").first();
  assert.equal(row.draft_revision, 1); assert.equal(row.publish_draft_json, null);
});
test("selection enforces ownership, source expiry and request identifier types", async t => {
  const f = routeFixture(t);
  assert.equal((await f.post({ requestId: [] })).status, 400);
  f.user.id = "other-user"; assert.equal((await f.post({})).status, 404);
  f.user.id = "u"; f.run([{ sql: "UPDATE media_assets SET expires_at=datetime('now','-1 day') WHERE id='a'" }]);
  assert.equal((await f.post({})).status, 410); assert.equal(f.calls.length, 0);
});

test("social publishing freezes the owned MP4 without requiring a completed cover or a paid tier", async t => {
  const f = await renderFixture(t); f.user.tier = "free";
  f.run([{ sql: "UPDATE media_assets SET status='ready' WHERE id='video'" }, { sql: "UPDATE render_jobs SET status='failed' WHERE id='job'" }]);
  const encrypted = [];
  let schedulingEnabled = true;
  const background = [];
  const route = loadModule("app/api/video-projects/[id]/social/posts/route.ts", {
    "@/auth": { auth: async () => ({ user: { id: f.user.id } }) },
    "@/lib/cf": { cfBackground: async work => {background.push(work);}, cf: async () => ({ DB: f.db, SCRIBIX_MEDIA: { head: async () => ({ size: 100 }) } }) },
    "@/lib/current-user": { getOrCreateCurrentUser: async () => f.user },
    "@/lib/clipflight": { clipflightEnabled: () => true, socialSchedulingEnabled: async () => schedulingEnabled },
    "@/lib/r2": { presignGet: async () => "https://fixture/source.mp4?signature=private" },
    "@/lib/social-submissions": { socialRequestHash: async value => JSON.stringify(value), encryptSocialRequest: async value => { encrypted.push(value); return "ciphertext"; }, refreshSocialSubmission: async (_db, row) => ({ id: row.id, status: "submitting" }) },
  });
  const params = { params: Promise.resolve({ id: "p" }) };
  const body = { submissionId: "00000000-0000-4000-8000-000000000001", renderJobId: "job", expectedRevision: f.workspace.revision, confirmed: true, caption: "Frozen copy", accountIds: ["account"] };
  const submit = value => route.POST(new Request("https://scribix.io/api", { method: "POST", headers: { Origin: "https://scribix.io" }, body: JSON.stringify(value) }), params);
  assert.equal((await submit(body)).status, 202);
  assert.equal((await submit(body)).status, 202);
  assert.equal(encrypted.length, 1);
  const saved = await f.db.prepare("SELECT * FROM social_submissions WHERE id=?1").bind(body.submissionId).first();
  assert.equal(saved.request_encrypted, "ciphertext");
  const asset = await f.db.prepare("SELECT social_hold_until FROM media_assets WHERE id='video'").first();
  assert.ok(asset.social_hold_until > Date.now() / 1000);
  assert.equal((await submit({ ...body, caption: "Changed" })).status, 409);
  assert.equal((await submit({ ...body, submissionId: "00000000-0000-4000-8000-000000000002", expectedRevision: -1 })).status, 409);
  const grouped = {...body, submissionId: "00000000-0000-4000-8000-000000000003", batchId: "00000000-0000-4000-8000-000000000009", platform: "youtube", title: "Selected clip"};
  assert.equal((await submit(grouped)).status, 202);
  assert.equal(background.length, 1, "provider transfer is scheduled outside the response");
  const groupedRow = await f.db.prepare("SELECT batch_id, display_json FROM social_submissions WHERE id=?").bind(grouped.submissionId).first();
  assert.equal(groupedRow.batch_id, grouped.batchId);
  assert.equal(JSON.parse(groupedRow.display_json).caption, "Frozen copy");
  assert.equal((await submit({...grouped, batchId: "not-a-task"})).status, 400);
  assert.equal((await submit({...grouped, title: "Changed"})).status, 409);
  const schedule = {...grouped, submissionId: "00000000-0000-4000-8000-000000000004", mode: "schedule", scheduledAt: Math.floor(Date.now()/1000)+3600, timezone: "Australia/Melbourne"};
  schedulingEnabled = false;
  assert.equal((await submit(schedule)).status, 503, "legacy service cannot receive scheduled content");
  schedulingEnabled = true;
  assert.equal((await submit({...schedule, scheduledAt: 1})).status, 400);
  assert.equal((await submit(schedule)).status, 202);
  assert.equal(encrypted.at(-1).mode, "schedule");
  assert.equal(encrypted.at(-1).scheduledAt, schedule.scheduledAt);
  assert.equal((await submit({...schedule, scheduledAt: schedule.scheduledAt+60})).status, 409);
  f.user.id = "other"; assert.equal((await submit(body)).status, 404);
});

test("Scribix connection return rejects another user and consumes the saved state once", async t => {
  const f = database(); t.after(f.dispose); let userId = "other"; let lookups = 0;
  f.run([{ sql: "INSERT INTO social_connection_returns (state_hash,user_id,project_id,locale,connection_session_id,created_at,expires_at) VALUES ('digest','u','p','ja','external-session',0,unixepoch()+600)" }]);
  const route = loadModule("app/api/social/callback/route.ts", {
    "@/auth": { auth: async () => ({ user: { id: userId } }) }, "@/lib/cf": { cf: async () => ({ DB: f.db }) },
    "@/lib/current-user": { getOrCreateCurrentUser: async () => ({ id: userId }) },
    "@/lib/clipflight": { socialStateHash: async () => "digest", clipflightRequest: async () => { lookups++; return Response.json({ session: { status: "connected" } }); } },
  });
  const request = () => new Request(`https://scribix.io/api/social/callback?state=${"a".repeat(64)}&connectionSessionId=external-session`);
  assert.equal((await route.GET(request())).status, 410); assert.equal(lookups, 0);
  userId = "u"; const response = await route.GET(request()); assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get("Location")).pathname, "/ja/dashboard/video-projects/p");
  assert.equal((await route.GET(request())).status, 410); assert.equal(lookups, 1);
});

test("account connections work before upload and return to the localized account page", async t => {
  const f = database(); t.after(f.dispose);
  let enabled = true; let userId = "u"; const calls = [];
  const mocks = {
    "@/auth": { auth: async () => ({ user: { id: userId } }) },
    "@/lib/cf": { cf: async () => ({ DB: f.db }) },
    "@/lib/current-user": { getOrCreateCurrentUser: async () => ({ id: userId }) },
    "@/lib/clipflight": {
      clipflightEnabled: () => enabled, socialStateHash: async () => "account-digest",
      clipflightRequest: async (_user, path, options) => {
        calls.push({ path, options });
        if (path === "/connection-sessions") return Response.json({ id: "account-session", connectionUrl: "https://app.clipflight.com/connect#ticket" });
        if (path.startsWith("/connection-sessions/")) return Response.json({ session: { status: "connected" } });
        return Response.json({ accounts: [] });
      },
    },
  };
  const route = loadModule("app/api/social/connections/route.ts", mocks);
  const request = (origin = "https://scribix.io") => new Request("https://scribix.io/api/social/connections", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ platform: "youtube", locale: "de", projectId: "another-users-project", returnUrl: "https://evil.example" }),
  });
  assert.equal((await route.POST(request("https://evil.example"))).status, 403);
  enabled = false; assert.equal((await route.POST(request())).status, 404);
  enabled = true; assert.equal((await route.POST(request())).status, 200);
  const row = await f.db.prepare("SELECT * FROM social_connection_returns WHERE state_hash='account-digest'").first();
  assert.equal(row.project_id, null); assert.equal(row.user_id, "u");
  const callback = loadModule("app/api/social/callback/route.ts", mocks);
  const back = () => new Request(`https://scribix.io/api/social/callback?state=${"b".repeat(64)}&connectionSessionId=account-session`);
  userId = "other"; assert.equal((await callback.GET(back())).status, 410);
  userId = "u"; const response = await callback.GET(back());
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get("Location")).pathname, "/de/dashboard/accounts");
  assert.equal((await callback.GET(back())).status, 410);
  assert.equal(calls.filter(c => c.path.startsWith("/connection-sessions/")).length, 1);
  const project = loadModule("app/api/video-projects/[id]/social/connections/route.ts", mocks);
  assert.equal((await project.GET(new Request("https://scribix.io"), { params: Promise.resolve({ id: "missing" }) })).status, 404);
});


test("social origins use trusted public configuration behind a local tunnel", () => {
  const origin = loadModule("lib/social-origin.ts", {}, { process: { env: { AUTH_URL: "https://local.scribix.io" } } });
  const request = new Request("http://localhost:3000/api/social/connections", { headers: { Origin: "https://local.scribix.io" } });
  assert.equal(origin.validSocialOrigin(request), true);
  assert.equal(origin.socialOrigin(request), "https://local.scribix.io");
  assert.equal(origin.validSocialOrigin(new Request(request.url, { headers: { Origin: "https://evil.example", "X-Forwarded-Host": "evil.example" } })), false);
  assert.equal(origin.validSocialOrigin(new Request(request.url)), false);
});

test("independent history scopes records and retries to the current user", async t => {
  const f = database(); t.after(f.dispose); let userId = "u"; let remoteCalls = 0;
  const now = Math.floor(Date.now()/1000);
  f.run([{sql: "INSERT INTO social_submissions(id,user_id,project_id,render_job_id,request_hash,created_at,expires_at,remote_post_id,result_json) VALUES('submission','u','p','render','hash',?,?,'remote',?)", values:[now,now+3600,JSON.stringify({id:"remote",status:"published",caption:"Published copy",targets:[]})]}]);
  const route = loadModule("app/api/social/posts/route.ts", {
    "@/auth":{auth:async()=>({user:{id:userId}})}, "@/lib/cf":{cf:async()=>({DB:f.db})},
    "@/lib/current-user":{getOrCreateCurrentUser:async()=>({id:userId})},
    "@/lib/clipflight":{clipflightEnabled:()=>true,clipflightRequest:async()=>{remoteCalls++;return Response.json({ok:true});}},
    "@/lib/social-submissions":{refreshSocialSubmission:async()=>{throw new Error("terminal posts must remain cached");}},
  });
  const result = await (await route.GET(new Request("https://scribix.io/api/social/posts"))).json(); assert.equal(result.posts.length,1); assert.equal(result.posts[0].media.filename,"Test");
  f.run([{sql: "UPDATE social_submissions SET batch_id='owned-task' WHERE id='submission'"}]);
  assert.equal((await (await route.GET(new Request("https://scribix.io/api/social/posts?task=owned-task"))).json()).posts.length, 1);
  assert.equal((await (await route.GET(new Request("https://scribix.io/api/social/posts?task=missing-task"))).json()).posts.length, 0);
  const retry = () => route.PATCH(new Request("https://scribix.io/api/social/posts",{method:"PATCH",headers:{Origin:"https://scribix.io"},body:JSON.stringify({postId:"remote",targetId:"target"})}));
  userId="other"; assert.equal((await (await route.GET(new Request("https://scribix.io/api/social/posts"))).json()).posts.length,0); assert.equal((await retry()).status,404); assert.equal(remoteCalls,0);
  userId="u"; assert.equal((await retry()).status,202); assert.equal(remoteCalls,1);
});

test("compose review accepts current video with failed cover, rejects changed clips and other users", async t => {
  const f = await renderFixture(t); f.user.tier="free";
  f.run([{sql:"UPDATE media_assets SET status='ready' WHERE id='video'"},{sql:"UPDATE render_jobs SET status='failed' WHERE id='job'"}]);
  const route=loadModule("app/api/social/review/route.ts",{
    "@/auth":{auth:async()=>({user:{id:f.user.id}})},"@/lib/cf":{cf:async()=>({DB:f.db,SCRIBIX_MEDIA:{head:async()=>({size:100})}})},
    "@/lib/current-user":{getOrCreateCurrentUser:async()=>f.user},"@/lib/clipflight":{clipflightEnabled:()=>true},"@/lib/r2":{presignGet:async()=>"https://fixture/video"},
  });
  const request=()=>new Request("https://scribix.io/api/social/review?projectId=p&candidateId=c&renderJobId=job");
  let response=await route.GET(request());assert.equal(response.status,200);const draft=await response.json();assert.equal(draft.media.id,"job");assert.ok(draft.storageKey.includes(":u:p:c:job"));
  f.user.id="other";assert.equal((await route.GET(request())).status,409);f.user.id="u";
  f.run([{sql:"UPDATE clip_candidates SET draft_edl_json='{}' WHERE id='c'"}]);assert.equal((await route.GET(request())).status,409);
});

test("compose retains the same submission after uncertain transport and across reload",async()=>{
  const storage=new Map();const bodies=[];let fail=true;
  const globals={sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async(_url,init)=>{bodies.push(JSON.parse(init.body));if(fail)throw new Error("network");return Response.json({post:{id:"remote"}});}};
  const draft={storageKey:"user:clip:render",projectId:"p",revision:2,media:{id:"render"}};
  let api=loadModule("app/components/publishing/api.ts",{},globals);
  await assert.rejects(api.createPost({mediaId:"render",caption:"Original",accountIds:["a"]},draft));
  api=loadModule("app/components/publishing/api.ts",{},globals);assert.equal(api.hasPendingPost(draft.storageKey),true);fail=false;
  await api.createPost({mediaId:"render",caption:"Changed",accountIds:["b"]},draft);
  assert.equal(bodies[0].submissionId,bodies[1].submissionId);assert.equal(bodies[1].caption,"Original");assert.equal(api.hasPendingPost(draft.storageKey),false);
  const polling=loadModule("app/components/publishing/history-polling.ts");assert.equal(polling.nextHistoryPollDelay([{status:"published",targets:[]}]),null);assert.ok(polling.nextHistoryPollDelay([{status:"importing",targets:[]}])>=10000);
});


test("Publishing accepts any signed-in identity and preserves upstream user isolation", async () => {
  const env = { CLIPFLIGHT_API_KEY: "fixture" };
  const users = [];
  const api = loadModule("lib/clipflight.ts", { "server-only": {} }, {
    process: { env }, Headers, AbortSignal,
    fetch: async (_url, init) => {
      users.push(init.headers.get("X-External-User-Id"));
      return Response.json({ accounts: [] });
    },
  });
  for (const id of ["existing-user", "new-user"]) {
    assert.equal(api.clipflightEnabled(id), true);
    assert.equal((await api.clipflightRequest(id, "/accounts")).status, 200);
  }
  for (const id of ["", "   "]) {
    assert.equal(api.clipflightEnabled(id), false);
    assert.equal((await api.clipflightRequest(id, "/accounts")).status, 404);
  }
  env.CLIPFLIGHT_API_KEY = "";
  assert.equal(api.clipflightEnabled("new-user"), false);
  assert.equal((await api.clipflightRequest("new-user", "/accounts")).status, 404);
  assert.deepEqual(users, ["existing-user", "new-user"]);
});

test("TikTok pause blocks connections, hidden targets, stored posts and retries at transport boundary", async () => {
  const calls = [];
  const env = { CLIPFLIGHT_API_KEY: "fixture", CLIPFLIGHT_TIKTOK_PUBLISH_ENABLED: "false" };
  const api = loadModule("lib/clipflight.ts", { "server-only": {} }, {
    process: { env }, Headers, AbortSignal,
    fetch: async (url, init) => {
      const path = url.replace("https://app.clipflight.com/api/v1", "");
      calls.push({ path, method: init.method });
      if (path === "/accounts") return Response.json({ accounts: [{ id: "yt", platform: "youtube" }, { id: "tt", platform: "tiktok" }, { id: "li", platform: "linkedin" }] });
      if (path === "/posts/post") return Response.json({ post: { targets: [{ id: "yt-target", platform: "youtube" }, { id: "tt-target", platform: "tiktok" }, { id: "li-target", platform: "linkedin" }] } });
      return Response.json({ ok: true });
    },
  });
  const post = (path, body) => api.clipflightRequest("owner", path, { method: "POST", body: JSON.stringify(body) });
  assert.equal((await post("/connection-sessions", { platform: "tiktok" })).status, 403);
  assert.equal((await api.clipflightRequest("owner", "/accounts/tt/creator-info")).status, 403);
  assert.equal((await post("/posts", { accountIds: ["tt"], tiktok: [{}] })).status, 403);
  assert.equal((await post("/posts", { accountIds: ["yt", "tt"] })).status, 403);
  assert.equal((await post("/posts", { accountIds: ["unknown"] })).status, 403);
  assert.equal((await post("/posts/post/retry", { targetId: "tt-target" })).status, 403);
  assert.equal(calls.some(call => call.method === "POST"), false);
  assert.equal((await post("/posts", { accountIds: ["yt"] })).status, 200);
  assert.equal((await post("/posts/post/retry", { targetId: "yt-target" })).status, 200);
  assert.equal((await post("/connection-sessions", { platform: "youtube" })).status, 200);
  assert.equal((await api.clipflightRequest("owner", "/accounts/tt", { method: "DELETE" })).status, 200);
  assert.equal((await post("/connection-sessions", { platform: "linkedin" })).status, 200);
  assert.equal((await post("/posts", { accountIds: ["yt", "li"] })).status, 200);
  assert.equal((await post("/posts/post/retry", { targetId: "li-target" })).status, 200);
  assert.equal((await post("/posts", { accountIds: ["li", "tt"] })).status, 403);
  env.CLIPFLIGHT_TIKTOK_PUBLISH_ENABLED = "true";
  assert.equal((await post("/posts", { accountIds: ["tt"], tiktok: [{}] })).status, 200);
});

test("project thumbnail media preserves ownership and streams valid byte ranges", async () => {
  let owned = true;
  let signed = 0;
  const reads = [];
  const route = loadModule("app/api/video-projects/[id]/source/route.ts", {
    "@/auth": { auth: async () => ({ user: { id: "owner" } }) },
    "@/lib/current-user": { getOrCreateCurrentUser: async () => ({ id: "owner" }) },
    "@/lib/video-workspace/lifecycle": {},
    "@/lib/r2": { presignGet: async () => { signed++; return "https://fixture/source"; } },
    "@/lib/cf": { cf: async () => ({
      DB: { prepare: sql => { assert.match(sql, /project.user_id = \?2/); assert.match(sql, /source.expires_at > CURRENT_TIMESTAMP/); return { bind: (id, user) => { assert.equal(id, "project"); assert.equal(user, "owner"); return { first: async () => owned ? { r2_key: "owned-video" } : null }; } }; } },
      SCRIBIX_MEDIA: {
        head: async () => ({ size: 100, httpMetadata: { contentType: "video/mp4" } }),
        get: async (key, options) => { reads.push({ key, range: options?.range }); return { body: new Uint8Array(options?.range.length ?? 100) }; },
      },
    }) },
  });
  const get = (range, media = true) => route.GET(new Request(`https://scribix.io/api/source${media ? "?format=media" : ""}`, { headers: range ? { Range: range } : {} }), { params: Promise.resolve({ id: "project" }) });
  for (const [header, expected, length] of [["bytes=10-19", "bytes 10-19/100", 10], ["bytes=90-", "bytes 90-99/100", 10], ["bytes=-5", "bytes 95-99/100", 5]]) {
    const response = await get(header);
    assert.equal(response.status, 206); assert.equal(response.headers.get("content-range"), expected);
    assert.equal((await response.arrayBuffer()).byteLength, length);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
  for (const range of ["bytes=100-", "bytes=9-2", "bytes=-0", "bytes=-", "bytes=0-2,5-9"]) assert.equal((await get(range)).status, 416);
  assert.equal(reads.length, 3);
  assert.equal((await get()).status, 200);
  assert.equal(signed, 0);
  assert.equal((await get(undefined, false)).status, 200); assert.equal(signed, 1);
  owned = false;
  assert.equal((await get("bytes=0-9")).status, 404); assert.equal(reads.length, 4);
});

test("LinkedIn discovery and video checks reuse the provider contract while TikTok stays paused", async () => {
  const api = loadModule("app/components/publishing/api.ts", {}, { fetch: async url => Response.json(
    url.endsWith("availability") ? { maxTargets: 2, tiktokPublishingEnabled: false } :
      { accounts: [{ id: "li", platform: "linkedin", status: "active" }, { id: "tt", platform: "tiktok", status: "active" }] }
  ) });
  const providers = await api.getAccounts();
  assert.deepEqual(plain(providers.map(p => p.platform)), ["youtube", "linkedin"]);
  assert.equal(providers.find(p => p.platform === "linkedin").accounts[0].id, "li");
  const { checkMedia } = loadModule("app/components/publishing/shared/specs.ts");
  const media = { filename: "export.mp4", sizeBytes: 100_000, contentType: "video/mp4", durationMs: 5000, width: 1080, height: 1920, rotation: 0, fps: 30, videoCodec: "avc1", audioCodec: "aac", probeStatus: "ok", probeError: null };
  const blocked = patch => checkMedia({...media, ...patch}).filter(c => c.platform === "linkedin" && c.level === "block").map(c => c.code);
  assert.deepEqual(plain(blocked({})), []);
  assert.ok(blocked({sizeBytes: 74999}).includes("FILE_TOO_SMALL"));
  assert.ok(blocked({sizeBytes: 500_000_001}).includes("FILE_TOO_LARGE"));
  assert.ok(blocked({durationMs: 1800_001}).includes("DURATION_TOO_LONG"));
  assert.ok(blocked({videoCodec: "av01"}).includes("VIDEO_CODEC_UNSUPPORTED"));
});


test("repaired framing replaces saved fallback and missing plans while preserving manual choices", async t => {
  const f = publishFixture(t);
  const fallback = { schemaVersion: 1, analyzer: "analysis-unavailable-v1", sourceStartMs: 0, sourceEndMs: 29900, points: [{ sourceMs: 0, framingMode: "fit", crop: { x: .5, y: .5, zoom: 1 } }] };
  const repaired = { ...fallback, analyzer: "mediapipe-talknet-v5", points: [{ sourceMs: 0, framingMode: "fill", crop: { x: .52, y: .5, zoom: 1 } }] };
  f.renderSpec.segments.s0.framingMode = "fit";
  f.renderSpec.segments.s0.autoFraming = fallback;
  assert.equal((await f.save()).ok, true);
  f.setPreview({ status: "ready", segments: [{ segmentIndex: 0, autoFraming: repaired }] });
  const result = await f.editor.loadEditorWorkspace(f.db, f.bucket, "u", "p", "c");
  assert.equal(result.ok, true);
  assert.equal(result.workspace.analysisUpdated, true);
  assert.equal(result.workspace.renderSpec.segments.s0.framingMode, "fit");
  assert.deepEqual(plain(result.workspace.renderSpec.segments.s0.autoFraming), repaired);
  assert.deepEqual(plain(result.workspace.renderSpec.captions), plain(f.renderSpec.captions));
  const saved = await f.editor.saveProjectDraft(f.db, "u", "p", "c", 1, result.workspace.edl, result.workspace.renderSpec);
  assert.equal(saved.ok, true);
  const next = await f.editor.loadEditorWorkspace(f.db, f.bucket, "u", "p", "c");
  assert.equal(next.workspace.analysisUpdated, false);
  delete next.workspace.renderSpec.segments.s0.autoFraming;
  assert.equal((await f.editor.saveProjectDraft(f.db, "u", "p", "c", 2, next.workspace.edl, next.workspace.renderSpec)).ok, true);
  const missing = await f.editor.loadEditorWorkspace(f.db, f.bucket, "u", "p", "c");
  assert.equal(missing.workspace.analysisUpdated, true);
  assert.equal(missing.workspace.renderSpec.segments.s0.autoFraming.analyzer, repaired.analyzer);
});

test("platform batch request IDs reach the server even after a successful response is lost locally", async () => {
  const bodies = [];
  const globals = {sessionStorage: {getItem: () => null, setItem: () => {}, removeItem: () => {}}, fetch: async (_url, init) => {
    bodies.push(JSON.parse(init.body)); return Response.json({post: {id: "remote"}});
  }};
  const draft = {storageKey: "batch:youtube", projectId: "project", revision: 4, media: {id: "render"}};
  const input = {mediaId: "render", caption: "YouTube copy", accountIds: ["youtube-account"]};
  const submissionId = "a64b6e8f-bce1-4798-8dda-ef768f49d77f";
  await loadModule("app/components/publishing/api.ts", {}, globals).createPost(input, draft, submissionId);
  await loadModule("app/components/publishing/api.ts", {}, globals).createPost(input, draft, submissionId);
  assert.equal(bodies[0].submissionId, submissionId);
  assert.deepEqual(bodies[0], bodies[1]);
});

test("source selection creates independent clips before AI and preserves them through AI selection", async t => {
  const f=database();t.after(f.dispose);let user={id:"u",tier:"basic"};let present=true;
  f.run([{sql:"UPDATE media_assets SET r2_key='source.mp4' WHERE id='a'"}]);
  const route=loadModule("app/api/video-projects/[id]/source-clips/route.ts",{
    "@/auth":{auth:async()=>({user:{id:user.id}})},
    "@/lib/cf":{cf:async()=>({DB:f.db,SCRIBIX_MEDIA:{head:async()=>present?{size:123}:null,get:async()=>({json:async()=>({words:[{text:"Hello",start:1000,end:1500},{text:"world",start:1600,end:2000}]})})}})},
    "@/lib/current-user":{getOrCreateCurrentUser:async()=>user},
  });
  const params={params:Promise.resolve({id:"p"})};
  const read=()=>route.GET(new Request("https://scribix.io/api/video-projects/p/source-clips"),params);
  const submit=body=>route.POST(new Request("https://scribix.io/api/video-projects/p/source-clips",{method:"POST",headers:{origin:"https://scribix.io","content-type":"application/json"},body:JSON.stringify(body)}),params);
  assert.equal((await (await read()).json()).words.length,2);
  assert.equal((await f.db.prepare("SELECT count(*) AS n FROM clip_candidates").first()).n,0,"viewing the source creates no clips");
  const body={requestId:"00000000-0000-4000-8000-000000000021",startMs:90000,endMs:120000};
  assert.equal((await submit(body)).status,201);
  assert.equal((await submit(body)).status,201);
  assert.equal((await submit({...body,endMs:121000})).status,409);
  assert.equal((await submit({...body,requestId:"00000000-0000-4000-8000-000000000022",startMs:120000,endMs:150000})).status,201);
  assert.equal((await f.db.prepare("SELECT count(*) AS n FROM clip_candidates").first()).n,2);
  const candidates=loadModule("lib/video-workspace/candidates.ts");
  await candidates.replaceClipCandidates(f.db,"u","p",{candidates:[]});
  const saved=await f.db.prepare("SELECT segments_json FROM clip_candidates WHERE id=?").bind(body.requestId).first();
  assert.deepEqual(JSON.parse(saved.segments_json),[{startMs:90000,endMs:120000}]);
  assert.equal((await submit({...body,requestId:"00000000-0000-4000-8000-000000000023",startMs:0,endMs:90000})).status,201);
  assert.equal((await submit({...body,startMs:0,endMs:91000})).status,400);
  assert.equal((await submit({...body,startMs:-1})).status,400);
  user={id:"u",tier:"free"};assert.equal((await submit(body)).status,402);
  user={id:"other",tier:"basic"};assert.equal((await read()).status,404);assert.equal((await submit(body)).status,404);
  user={id:"u",tier:"basic"};present=false;assert.equal((await submit(body)).status,410);
});

test("an older publishing service never receives a schedule as publish-now", async () => {
  const calls = [];
  const service = loadModule("lib/clipflight.ts", {"server-only": {}}, {
    process: {env: {CLIPFLIGHT_API_KEY: "test-only", CLIPFLIGHT_TIKTOK_PUBLISH_ENABLED: "true"}},
    AbortSignal,
    fetch: async (url, options) => {calls.push([url, options.method]); return Response.json({error:"not_found"}, {status:404});},
  });
  const response = await service.clipflightRequest("user", "/posts", {method:"POST", body:JSON.stringify({mode:"schedule", scheduledAt:123})});
  assert.equal(response.status, 503);
  assert.equal(calls.length, 1);
  assert.ok(calls[0][0].endsWith("/publishing-capabilities"));
});

test("schedule mutations only forward owned posts and invalidate shared history", async t => {
  const f = await renderFixture(t);
  f.run([{sql:"INSERT INTO social_submissions (id,user_id,project_id,render_job_id,request_hash,remote_post_id,created_at,expires_at,result_json) VALUES ('submission',?,'p','job','hash','remote',0,9999999999,'{}')",values:[f.user.id]}]);
  const calls=[];
  const route=loadModule("app/api/social/schedule/route.ts", {
    "@/auth":{auth:async()=>({user:{id:f.user.id}})},
    "@/lib/cf":{cf:async()=>({DB:f.db})},
    "@/lib/current-user":{getOrCreateCurrentUser:async()=>f.user},
    "@/lib/clipflight":{clipflightEnabled:()=>true,clipflightRequest:async(...args)=>{calls.push(args);return Response.json({ok:true});}},
  });
  const request=(postId,method="PATCH")=>new Request("https://scribix.io/api/social/schedule",{method,headers:{Origin:"https://scribix.io"},body:JSON.stringify({postId,scheduledAt:9999999999,timezone:"Australia/Melbourne"})});
  assert.equal((await route.PATCH(request("unowned"))).status,404);
  assert.equal(calls.length,0);
  assert.equal((await route.PATCH(request("remote"))).status,200);
  assert.equal((await f.db.prepare("SELECT result_json FROM social_submissions WHERE id='submission'").first()).result_json,null);
  assert.equal((await route.DELETE(request("remote","DELETE"))).status,200);
  assert.equal(calls[1][2].method,"DELETE");
});

test("batch API returns 202, preserves request identity and rejects overlong implicit ranges", async t => {
  const f=routeFixture(t);
  f.env.AI_CLIPS_BATCH_ENABLED="true";
  f.env.AI_CLIPS_QUEUE={send:async()=>{}};
  const first=await f.post({requestId:"batch-request",requirements:{mode:"specific",topic:"original",kind:"advice"}});
  assert.equal(first.status,202);
  const accepted=await first.json();assert.equal(accepted.task.range.endMs,180000);assert.equal(f.calls.length,0);
  f.env.AI_CLIPS_BATCH_ENABLED="false";
  const repeated=await f.post({requestId:"batch-request",requirements:{mode:"specific",topic:"changed",kind:"story"}});
  assert.equal(repeated.status,202);const same=await repeated.json();assert.equal(same.task.id,accepted.task.id);assert.equal(same.selection.requirements.topic,"original");
  assert.equal((await f.post({requestId:"other-request"})).status,409);
  const other=routeFixture(t);other.env.AI_CLIPS_BATCH_ENABLED="true";other.env.AI_CLIPS_QUEUE={send:async()=>{}};
  other.run([{sql:"UPDATE media_assets SET duration_ms=10800001 WHERE id='a'"}]);
  assert.equal((await other.post({requestId:"long-request"})).status,400);
  assert.equal((await other.post({requestId:"range-request",analysisRange:{startMs:0,endMs:10800000}})).status,202);
  assert.equal(other.calls.length,0);
});

test("generation settings survive auto mode and seed new clips without replacing saved edits", async t => {
  const generation={length:"long",captions:"minimal-v1",headline:true,framing:"fit"};
  const parsed=selection.parseSelection({mode:"auto",topic:"ignored",kind:"any",generation});
  assert.deepEqual(plain(parsed.generation),generation);
  assert.match(selection.selectionPrompt(parsed),/60–90 seconds/);
  assert.throws(()=>selection.parseSelection({...parsed,generation:{...generation,length:"unlimited"}}));
  const f=publishFixture(t);
  f.run([{sql:"UPDATE video_projects SET selection_json=?",values:[JSON.stringify(parsed)]}]);
  const first=await f.editor.loadEditorWorkspace(f.db,f.bucket,"u","p","c");
  assert.equal(first.workspace.renderSpec.captions.templateId,"minimal-v1");
  assert.equal(first.workspace.renderSpec.segments.s0.framingMode,"fit");
  assert.equal(first.workspace.renderSpec.openingTitle.text,"Opening");
  await f.editor.saveProjectDraft(f.db,"u","p","c",0,first.workspace.edl,{...first.workspace.renderSpec,captions:{...first.workspace.renderSpec.captions,enabled:false}});
  f.run([{sql:"UPDATE video_projects SET selection_json=?",values:[JSON.stringify({...parsed,generation:{...generation,captions:"boxed-v1"}})]}]);
  const saved=await f.editor.loadEditorWorkspace(f.db,f.bucket,"u","p","c");
  assert.equal(saved.workspace.renderSpec.captions.enabled,false);
  assert.equal(saved.workspace.renderSpec.captions.templateId,"minimal-v1");
});

test("review marks persist independently across candidates and cannot touch another owner", async t => {
  const f=publishFixture(t);
  f.run([{sql:"INSERT INTO clip_candidates(id,user_id,project_id,rank,theme,hook,reason,score,segments_json) SELECT 'c2',user_id,project_id,1,theme,hook,reason,score,segments_json FROM clip_candidates WHERE id='c'"}]);
  const route=loadModule("app/api/video-projects/[id]/candidates/[candidateId]/route.ts",{"@/auth":{auth:async()=>({user:{id:f.user.id}})},"@/lib/cf":{cf:async()=>({DB:f.db})},"@/lib/current-user":{getOrCreateCurrentUser:async()=>f.user}});
  const patch=(id,mark)=>route.PATCH(new Request("http://local/api",{method:"PATCH",body:JSON.stringify({reviewMark:mark})}),{params:Promise.resolve({id:"p",candidateId:id})});
  assert.equal((await patch("c","keep")).status,200);
  assert.equal((await patch("c2","keep")).status,200);
  assert.equal((await f.db.prepare("SELECT COUNT(*) n FROM clip_candidates WHERE review_mark='keep'").first()).n,2);
  assert.equal((await patch("c",null)).status,200);
  f.user.id="other";assert.equal((await patch("c2","discard")).status,404);
  assert.equal((await f.db.prepare("SELECT review_mark FROM clip_candidates WHERE id='c2'").first()).review_mark,"keep");
});

test("free review can read owned clips but cannot save or snapshot edits", async () => {
  let reads=0;
  const route=loadModule("app/api/video-projects/[id]/editor/route.ts", {
    "@/auth":{auth:async()=>({user:{id:"u"}})},
    "@/lib/cf":{cf:async()=>({DB:{},SCRIBIX_MEDIA:{}})},
    "@/lib/current-user":{getOrCreateCurrentUser:async()=>({id:"u",tier:"free"})},
    "@/lib/video-workspace/editor":{loadEditorWorkspace:async()=>{reads++;return {ok:true,workspace:{revision:0}};},saveProjectDraft:()=>assert.fail("review cannot save"),snapshotProjectDraft:()=>assert.fail("review cannot snapshot")},
  });
  const params={params:Promise.resolve({id:"p"})};
  assert.equal((await route.GET(new Request("http://local/editor?candidateId=c&view=review"),params)).status,200);
  assert.equal((await route.GET(new Request("http://local/editor?candidateId=c"),params)).status,402);
  for(const method of ["PUT","POST"])assert.equal((await route[method](new Request("http://local/editor?view=review",{method,body:"{}"}),params)).status,402);
  assert.equal(reads,1);
});
