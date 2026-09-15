import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import test from "node:test";

function load() {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("../app/components/publishing/platform-batch.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {exports, crypto: {randomUUID}});
  return exports;
}
function setup() {
  const values = new Map();
  return {
    draft: {media: {id: "video"}, revision: 8, projectId: "project", candidateId: "clip", storageKey: randomUUID()},
    storage: {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)},
    submissions: [
      {platform: "youtube", input: {mediaId: "video", accountIds: ["yt"], caption: "YouTube description", youtubeTitle: "YouTube title"}},
      {platform: "linkedin", input: {mediaId: "video", accountIds: ["li"], caption: "LinkedIn copy"}},
    ],
    onUpdate: () => {},
  };
}

test("one action submits each platform with its own text and request ID", async () => {
  const api = load(); const options = setup(); const calls = [];
  const batch = await api.submitPlatformBatch({...options, send: async (input, draft, id) => {
    calls.push({input, draft, id}); return {postId: input.accountIds[0]};
  }});
  assert.equal(calls.length, 2);
  assert.equal(calls[0].input.caption, "YouTube description");
  assert.equal(calls[1].input.caption, "LinkedIn copy");
  assert.notEqual(calls[0].id, calls[1].id);
  assert.equal(batch.entries.every(item => item.postId), true);
});

test("retry after reload skips successful platforms and preserves uncertain requests", async () => {
  let api = load(); const options = setup(); const calls = [];
  await api.submitPlatformBatch({...options, send: async (input, draft, id) => {
    calls.push({input, draft, id});
    if (input.accountIds[0] === "li") throw new Error("response lost");
    return {postId: "yt-post"};
  }});
  api = load(); // Simulate leaving the page: memory is gone, persisted requests remain.
  const result = await api.submitPlatformBatch({...options, draft: {...options.draft, revision: 99}, submissions: [], send: async (input, draft, id) => {
    calls.push({input, draft, id}); return {postId: "li-post"};
  }});
  assert.equal(calls.length, 3);
  assert.equal(calls[2].input.accountIds[0], "li");
  assert.equal(calls[2].id, calls[1].id);
  assert.equal(calls[2].draft.revision, 8);
  assert.equal(result.entries[0].postId, "yt-post");
});

test("requests are persisted before sending and completed submissions never repeat", async () => {
  const api = load(); const options = setup(); let count = 0;
  const send = async () => {
    assert.equal(api.readPlatformBatch(options.draft, options.storage).entries.length, 2);
    count++; return {postId: String(count)};
  };
  await api.submitPlatformBatch({...options, send});
  await load().submitPlatformBatch({...options, send});
  assert.equal(count, 2);
});

test("only a completed batch can be explicitly replaced with another post", async () => {
  const api = load(); const options = setup();
  await api.submitPlatformBatch({...options, send: async () => { throw new Error("offline"); }});
  assert.equal(api.clearCompletedBatch(options.draft, options.storage), false);
  await api.submitPlatformBatch({...options, send: async () => ({postId: "sent"})});
  assert.equal(api.clearCompletedBatch(options.draft, options.storage), true);
  assert.equal(api.readPlatformBatch(options.draft, options.storage), null);
});

test("simultaneous progress readers share one sender", async () => {
  const api = load(); const options = setup(); let count = 0; let release;
  const gate = new Promise(resolve => {release = resolve;});
  const send = async () => {count++; await gate; return {postId: String(count)};};
  const first = api.submitPlatformBatch({...options, send});
  const second = api.submitPlatformBatch({...options, send});
  assert.equal(first, second);
  release(); await first;
  assert.equal(count, 2);
});

function loadTasks(storage) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("../app/components/publishing/publish-task.ts", import.meta.url), "utf8"), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(code, {exports, crypto: {randomUUID}, localStorage: storage});
  return exports;
}
test("task recovery preserves requests without media URLs and back navigation cannot duplicate them", () => {
  const options = setup(); const api = loadTasks(options.storage);
  const draft = {...options.draft, title: "Clip", previewUrl: "https://private/video?signature=secret"};
  const first = api.createPublishTask("owner", draft, options.submissions);
  const reloaded = loadTasks(options.storage);
  const again = reloaded.createPublishTask("owner", draft, options.submissions);
  assert.equal(first.id, again.id);
  assert.equal(again.draft.previewUrl, "");
  assert.equal(reloaded.readPublishTask("another-user", first.id), null);
  assert.equal(again.submissions.every(item => item.input.batchId === first.id), true);
});
test("history groups only the same task and retains per-platform copy and retry routing", () => {
  const api = loadTasks({});
  const post = (id, batchId, status) => ({id, batchId, status, caption: id + " copy", targets: [{id: id + " target", status}]});
  const grouped = api.groupPublishPosts([post("yt", "task", "published"), post("li", "task", "failed"), post("older", null, "published")]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].status, "partial");
  assert.equal(grouped[0].targets[1].postId, "li");
  assert.equal(grouped[0].targets[1].caption, "li copy");
  assert.equal(api.groupPublishPosts([post("yt", "task", "published"), post("li", "task", "processing")])[0].status, "publishing");
});
