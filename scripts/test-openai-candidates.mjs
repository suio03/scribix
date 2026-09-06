import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
function fixture(responses) {
  const requests = [];
  const logs = [];
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const exports = {};
    cache.set(path, exports);
    const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    vm.runInNewContext(outputText, {
      exports, Response, crypto: globalThis.crypto, TextEncoder,
      process: { env: { OPENAI_API_KEY: "test-only" } },
      console: { info: (line) => logs.push(JSON.parse(line)) },
      require(name) {
        const target = name.startsWith("@/") ? resolve(root, name.slice(2)) : resolve(dirname(path), name);
        assert.ok(target.startsWith(`${root}/lib/`), `Unexpected import: ${name}`);
        return load(`${target}.ts`);
      },
      fetch: async (url, init) => {
        assert.equal(url, "https://api.openai.com/v1/responses");
        const body = JSON.parse(init.body);
        assert.ok(body.prompt_cache_key === undefined || body.prompt_cache_key.length <= 64, "Provider cache-key limit");
        requests.push(body);
        assert.ok(responses.length, "Unexpected paid-provider request");
        const response = responses.shift();
        if (response instanceof Error) throw response;
        return response;
      },
    }, { filename: path });
    return exports;
  }
  return { api: load(resolve(root, "lib/openai-candidates.ts")),
    mapping: load(resolve(root, "lib/video-workspace/candidate-generation.ts")), requests, logs };
}
function transcript(sentenceCount = 60, long = false) {
  return { words: Array.from({ length: sentenceCount * 10 }, (_, index) => ({
    text: (long ? "text".repeat(90) : "word") + (index % 10 === 9 ? "." : ""),
    start: index * 1_000 + 123, end: index * 1_000 + 987, speaker: "A",
  })) };
}
function proposal(startSentenceId = "s10", endSentenceId = "s12") {
  return { theme: "Idea", hook: "A useful opening", reason: "Self-contained thought.", score: 0.9,
    startSentenceId, endSentenceId };
}
function completed(output, id = "response-test") {
  return Response.json({ id, status: "completed", service_tier: "default",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }],
    usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 20 }, output_tokens: 30,
      output_tokens_details: { reasoning_tokens: 10 }, total_tokens: 130 } });
}
const plain = (value) => JSON.parse(JSON.stringify(value));

test("two-stage API uses sentence references and local review, preserving exact milliseconds", async () => {
  const f = fixture([completed({ candidates: [proposal()] }), completed({ reviews: [{
    candidateIndex: 0, verdict: "adjust", completenessScore: 0.9, completenessReason: "Setup included.",
    startSentenceId: "s9", endSentenceId: "s12",
  }] })]);
  const analysis = f.mapping.buildCandidateAnalysisInput(transcript(), 600_000);
  const generated = await f.api.generateCandidatesWithOpenAI(analysis);
  const reviewed = await f.api.reviewCandidatesWithOpenAI(analysis, generated.candidates);
  assert.deepEqual(plain(reviewed.candidates.candidates[0].segments), [{ startMs: 90_123, endMs: 129_987 }]);
  assert.equal(f.requests.length, 2);
  for (const body of f.requests) {
    assert.equal(body.model, "gpt-5.6-terra");
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.input[0].role, "user");
    assert.equal(body.input[0].content[0].type, "input_text");
    assert.doesNotMatch(body.input[0].content[0].text, /100123-100987:word/);
    const item = (body.text.format.schema.properties.candidates ?? body.text.format.schema.properties.reviews).items;
    assert.ok(item.required.includes("startSentenceId"));
    assert.ok(!("segments" in item.properties));
  }
  const firstText = f.requests[0].input[0].content[0].text;
  const reviewText = f.requests[1].input[0].content[0].text;
  assert.ok(firstText.includes("s59|"));
  assert.ok(!reviewText.includes("s59|"));
  assert.ok(!reviewText.includes("Self-contained thought."));
  assert.ok(reviewText.length < firstText.length / 2);
});

for (const invalid of [proposal("s999", "s1000"),
  { theme: "Idea", hook: "Hook", reason: "Reason", score: 0.9, segments: [{ startMs: 100123, endMs: 129987 }] }]) {
  test("invalid or legacy timestamp payload fails and retains usage for billing", async () => {
    const f = fixture([completed({ candidates: [invalid] })]);
    await assert.rejects(f.api.generateCandidatesWithOpenAI(f.mapping.buildCandidateAnalysisInput(transcript())),
      (error) => error.providerCode === "invalid_candidate_payload" && error.usage.totalTokens === 130);
  });
}

test("second-stage IDs outside local context cannot pass validation", async () => {
  const f = fixture([completed({ reviews: [{ candidateIndex: 0, verdict: "adjust", completenessScore: 0.9,
    completenessReason: "Invalid jump.", startSentenceId: "s50", endSentenceId: "s52" }] })]);
  const analysis = f.mapping.buildCandidateAnalysisInput(transcript());
  const proposed = f.mapping.parseSentenceCandidateSet({ candidates: [proposal()] }, analysis.sentences);
  await assert.rejects(f.api.reviewCandidatesWithOpenAI(analysis, proposed),
    (error) => error.providerCode === "invalid_candidate_review_payload" && error.usage.totalTokens === 130);
});

test("long input submits all bounded batches and aggregates known usage", async () => {
  const responses = [];
  const f = fixture(responses);
  const analysis = f.mapping.buildCandidateAnalysisInput(transcript(90, true));
  assert.ok(analysis.batches.length > 1);
  for (let index = 0; index < analysis.batches.length; index++) responses.push(completed({ candidates: [] }, `r${index}`));
  const result = await f.api.generateCandidatesWithOpenAI(analysis, { requestId: "batch-test" });
  assert.equal(f.requests.length, analysis.batches.length);
  f.requests.forEach((body, index) => assert.equal(body.input[0].content[0].text, analysis.batches[index].text));
  assert.equal(result.usage.totalTokens, 130 * analysis.batches.length);
  assert.equal(result.usage.cachedInputTokens, 20 * analysis.batches.length);
  assert.equal(result.responseId, null);
  const reviewed = await f.api.reviewCandidatesWithOpenAI(analysis, result.candidates);
  assert.equal(reviewed.usage, null);
  assert.equal(f.requests.length, analysis.batches.length, "zero proposals skip the second stage");
});

test("a failed later batch preserves earlier usage and safe provider diagnostics", async () => {
  const f = fixture([completed({ candidates: [] }), Response.json({
    error: { code: "string_above_max_length", param: "input[0].content[0].text", message: "PRIVATE PROVIDER TEXT" },
  }, { status: 400 })]);
  const analysis = f.mapping.buildCandidateAnalysisInput(transcript(90, true));
  await assert.rejects(f.api.generateCandidatesWithOpenAI(analysis),
    (error) => error.status === 400 && error.providerCode === "string_above_max_length" && error.usage.totalTokens === 130);
  assert.equal(f.logs.at(-1).providerParam, "input[0].content[0].text");
  assert.ok(!JSON.stringify(f.logs).includes("PRIVATE PROVIDER TEXT"));
  assert.equal(f.requests.length, 2);
});


test("oversized production and POC cache keys are stable, bounded, and distinct", async () => {
  const keys = [undefined, "x".repeat(64), `video-candidates:${"a".repeat(48)}`,
    `video-candidates:${"a".repeat(48)}`, `scribix-completeness-${"b".repeat(64)}`,
    `${"x".repeat(64)}a`, `${"x".repeat(64)}b`];
  const f = fixture(keys.map(() => completed({ candidates: [] })));
  const analysis = f.mapping.buildCandidateAnalysisInput(transcript());
  for (const promptCacheKey of keys) await f.api.generateCandidatesWithOpenAI(analysis, { promptCacheKey });
  const sent = f.requests.map((body) => body.prompt_cache_key);
  assert.equal(sent[0], undefined);
  assert.equal(sent[1], keys[1]);
  assert.equal(sent[2], sent[3]);
  assert.match(sent[2], /^[a-f0-9]{64}$/);
  assert.match(sent[4], /^[a-f0-9]{64}$/);
  assert.notEqual(sent[5], sent[6]);
});

test("review also bounds the same production cache key", async () => {
  const f = fixture([completed({ candidates: [proposal()] }), completed({ reviews: [{
    candidateIndex: 0, verdict: "accept", completenessScore: 0.9, completenessReason: "Complete.",
    startSentenceId: "s10", endSentenceId: "s12",
  }] })]);
  const analysis = f.mapping.buildCandidateAnalysisInput(transcript());
  const options = { promptCacheKey: `video-candidates:${"a".repeat(48)}` };
  const generated = await f.api.generateCandidatesWithOpenAI(analysis, options);
  await f.api.reviewCandidatesWithOpenAI(analysis, generated.candidates, options);
  assert.equal(f.requests[0].prompt_cache_key, f.requests[1].prompt_cache_key);
  assert.equal(f.requests[1].prompt_cache_key.length, 64);
});
