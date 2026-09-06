import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const python = `import sqlite3,json,sys
conn=sqlite3.connect(sys.argv[1],timeout=30,isolation_level=None)
conn.row_factory=sqlite3.Row
request=json.loads(sys.argv[2])
if request.get("script"):
 conn.executescript(request["sql"])
 print(json.dumps({"results":[],"meta":{"changes":conn.total_changes}}))
else:
 cursor=conn.execute(request["sql"],request.get("params",[]))
 rows=[dict(row) for row in cursor.fetchall()]
 print(json.dumps({"results":rows,"meta":{"changes":conn.total_changes}}))
conn.close()`;
function load(file, imports) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(resolve(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Response, console: { error() {}, log() {}, warn() {} },
    require(name) { assert.ok(name in imports, name); return imports[name]; } });
  return exports;
}
const contracts = { VIDEO_WORKSPACE_SCHEMA_VERSION: 1 };
const scheduling = load("lib/video-workspace/render-scheduling.ts", { "./contracts": contracts });
async function fixture(t, userCount = 10, jobsPerUser = 5) {
  const dir = mkdtempSync(join(tmpdir(), "scribix-render-scheduling-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "test.sqlite");
  const sql = async (query, params = [], script = false) => {
    const { stdout } = await execute("python3", ["-c", python, file, JSON.stringify({ sql: query, params, script })]);
    return JSON.parse(stdout);
  };
  await sql(`CREATE TABLE video_projects(id TEXT PRIMARY KEY, deleted_at TEXT);
    CREATE TABLE render_jobs(id TEXT PRIMARY KEY, user_id TEXT, project_id TEXT,
      kind TEXT, status TEXT DEFAULT 'queued', provider TEXT, provider_job_id TEXT,
      attempt INTEGER DEFAULT 0, error_code TEXT, provider_submitted_at TEXT,
      queued_at TEXT DEFAULT '2026-01-01 00:00:00', created_at TEXT DEFAULT '2026-01-01 00:00:00',
      updated_at TEXT DEFAULT '2026-01-01 00:00:00', started_at TEXT, completed_at TEXT,
      output_asset_id TEXT, cover_asset_id TEXT);
    CREATE TABLE media_assets(id TEXT PRIMARY KEY, status TEXT);`, [], true);
  const rows = [];
  for (let user = 0; user < userCount; user++) {
    for (let index = 0; index < jobsPerUser; index++) {
      const id = `u${String(user).padStart(2, "0")}-j${index}`;
      rows.push(`INSERT INTO video_projects VALUES ('${id}',NULL);`);
      rows.push(`INSERT INTO render_jobs(id,user_id,project_id,kind) VALUES ('${id}','u${user}','${id}','${index % 2 ? "final" : "preview"}');`);
    }
  }
  await sql(rows.join("\n"), [], true);
  const db = { prepare(query) { let params = []; return {
    bind(...values) { params = values; return this; },
    async first() { return (await sql(query, params)).results[0] ?? null; },
    async run() { return sql(query, params); },
    async all() { return sql(query, params); },
  }; } };
  db.batch = async (statements) => Promise.all(statements.map((statement) => statement.run()));
  const messages = [];
  const queue = { async send(message, options) { messages.push({ ...message, options }); } };
  return { db, sql, queue, messages };
}

test("25 competing claims admit 10 different users, including mixed previews and exports", async (t) => {
  const f = await fixture(t);
  const claims = (await Promise.all(Array.from({ length: 25 }, () => scheduling.claimNextRenderJob(f.db, 10)))).filter(Boolean);
  assert.equal(claims.length, 10);
  assert.equal(new Set(claims.map((job) => job.user_id)).size, 10);
  assert.equal(new Set(claims.map((job) => job.id)).size, 10);
  assert.equal((await f.sql("SELECT COUNT(*) AS n FROM render_jobs WHERE attempt=0")).results[0].n, 40);
});

test("one user's separate projects and final exports share a single slot", async (t) => {
  const f = await fixture(t, 1, 5);
  const claims = await Promise.all(Array.from({ length: 10 }, () => scheduling.claimNextRenderJob(f.db, 10)));
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal((await f.sql("SELECT SUM(attempt) AS n FROM render_jobs")).results[0].n, 1);
});

test("waiting users get their first turn before an earlier user's second job", async (t) => {
  const f = await fixture(t, 11, 2);
  const first = await scheduling.claimNextRenderJob(f.db, 1);
  await f.sql("UPDATE render_jobs SET status='completed' WHERE id=?", [first.id]);
  const second = await scheduling.claimNextRenderJob(f.db, 1);
  assert.notEqual(second.user_id, first.user_id);
  assert.equal(await scheduling.claimNextRenderJob(f.db, 1), null);
});

test("project polling recovers missing messages once per interval and respects ownership", async (t) => {
  const f = await fixture(t, 1, 2);
  await scheduling.recoverProjectRenderQueue(f.db, f.queue, "wrong-user", "u00-j0");
  assert.equal(f.messages.length, 0);
  await Promise.all(Array.from({ length: 8 }, () => scheduling.recoverProjectRenderQueue(f.db, f.queue, "u0", "u00-j0")));
  assert.equal(f.messages.length, 1);
  await f.sql("UPDATE render_jobs SET status='running',updated_at='2026-01-01' WHERE id='u00-j0'");
  await scheduling.recoverProjectRenderQueue(f.db, f.queue, "u0", "u00-j0");
  assert.equal(f.messages.length, 1);
});

test("deleted projects are never dispatched; no pending work emits no wake", async (t) => {
  const f = await fixture(t, 1, 1);
  await f.sql("UPDATE video_projects SET deleted_at=CURRENT_TIMESTAMP");
  assert.equal(await scheduling.claimNextRenderJob(f.db, 10), null);
  await f.sql("UPDATE render_jobs SET status='completed'");
  await scheduling.wakeRenderScheduler(f.db, f.queue);
  assert.equal(f.messages.length, 0);
});

function dispatcher(f, submit) {
  return load("workers/video-render-dispatcher.ts", {
    "@cloudflare/containers": { Container: class {} },
    "../lib/video-workspace/contracts": contracts,
    "../lib/video-workspace/render-scheduling": scheduling,
    "../lib/video-workspace/job-auth": { createScopedJobToken: async () => "test-only" },
    "../lib/video-workspace/events": { recordServerRenderEvent: async () => {} },
    "../lib/video-workspace/operations": {},
    "./video-render-provider": { CloudflareContainerRenderProvider: class {
      submit = submit;
      async cancel() {}
    } },
  }).default;
}
function batch() {
  return { messages: [{ body: { schemaVersion: 1, jobId: "u00-j0" }, attempts: 100, ack() {} }],
    ackAll() { this.acked = true; }, acked: false };
}
function env(f) { return { DB: f.db, VIDEO_RENDER_QUEUE: f.queue, VIDEO_RENDER_MAX_CONTAINERS: "10",
  SCRIBIX_INTERNAL_URL: "http://localhost:3000", VIDEO_WORKER_SIGNING_SECRET: "test" }; }

test("a single queue wake launches 10 users and acknowledges capacity waits", async (t) => {
  const f = await fixture(t);
  const started = [];
  const worker = dispatcher(f, async ({ jobId }) => { started.push(jobId); return jobId; });
  const message = batch();
  await worker.queue(message, env(f));
  assert.equal(started.length, 10);
  assert.equal(new Set(started.map((id) => id.split("-")[0])).size, 10);
  assert.equal(message.acked, true);
  await worker.queue(batch(), env(f));
  assert.equal(started.length, 10, "busy capacity does not restart jobs");
  assert.equal(f.messages.length, 0, "capacity waits do not retry queue messages");
});

test("actual startup failures use job attempts rather than message delivery count", async (t) => {
  const f = await fixture(t, 1, 1);
  const worker = dispatcher(f, async () => { throw new Error("provider unavailable"); });
  await worker.queue(batch(), { ...env(f), VIDEO_RENDER_MAX_CONTAINERS: "1" });
  const row = (await f.sql("SELECT status,attempt FROM render_jobs")).results[0];
  assert.deepEqual(row, { status: "queued", attempt: 1 });
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].options.delaySeconds, 15);
});

test("production enables ten containers, local stays one, and recovery is frequent", () => {
  const read = (file) => vm.runInNewContext(`(${readFileSync(resolve(root, file), "utf8")})`);
  const prod = read("wrangler.video-render.jsonc");
  const local = read("wrangler.video-render.local.jsonc");
  assert.equal(prod.containers[0].max_instances, 10);
  assert.equal(scheduling.renderConcurrency(prod.vars.VIDEO_RENDER_MAX_CONTAINERS), 10);
  assert.equal(local.containers[0].max_instances, 1);
  assert.equal(scheduling.renderConcurrency(local.vars.VIDEO_RENDER_MAX_CONTAINERS), 1);
  assert.equal(prod.triggers.crons[0], "* * * * *");
});


test("the fifth real startup failure terminates the job rather than retrying forever", async (t) => {
  const f = await fixture(t, 1, 1);
  await f.sql("UPDATE render_jobs SET attempt=4");
  const worker = dispatcher(f, async () => { throw new Error("provider unavailable"); });
  await worker.queue(batch(), { ...env(f), VIDEO_RENDER_MAX_CONTAINERS: "1" });
  assert.deepEqual((await f.sql("SELECT status,attempt,error_code FROM render_jobs")).results[0],
    { status: "failed", attempt: 5, error_code: "provider_unavailable" });
  assert.equal(f.messages.length, 0);
});

test("a completed signed result wakes the next user without waiting for the cron", async (t) => {
  const f = await fixture(t, 2, 2);
  const claimed = await scheduling.claimNextRenderJob(f.db, 1);
  let resultSaved = false;
  const route = load("app/api/internal/video-jobs/[id]/result/route.ts", {
    "@/lib/cf": { cf: async () => ({ ...env(f), SCRIBIX_MEDIA: {} }) },
    "@/lib/video-workspace/render-scheduling": scheduling,
    "@/lib/video-workspace/job-auth": { bearerToken: () => "test", verifyScopedJobToken: async () => true },
    "@/lib/video-workspace/final-internal-jobs": { renderJobKind: async () => "preview" },
    "@/lib/video-workspace/internal-jobs": { recordPreviewJobResult: async () => {
      await f.sql("UPDATE render_jobs SET status='completed' WHERE id=?", [claimed.id]);
      resultSaved = true;
      return { ok: true };
    } },
  });
  const request = { async json() { return { status: "completed", output: {
    bytes: 100, durationMs: 30000, width: 720, height: 1280, videoCodec: "h264", audioCodec: "aac",
  } }; } };
  const response = await route.POST(request, { params: Promise.resolve({ id: claimed.id }) });
  assert.equal(response.status, 200);
  assert.equal(resultSaved, true);
  assert.equal(f.messages.length, 1);
  const next = await scheduling.claimNextRenderJob(f.db, 1);
  assert.notEqual(next.user_id, claimed.user_id);
});
