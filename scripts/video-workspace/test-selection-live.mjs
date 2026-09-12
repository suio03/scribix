// Explicit live-provider validation; never run as part of default unit tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import nextEnv from "@next/env";
if (!process.argv.includes("--live")) throw new Error("Pass --live to authorize provider requests.");
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
const root = process.cwd(), cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const exports = {}; cache.set(path, exports);
  vm.runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, process, fetch, Response, TextEncoder, crypto: globalThis.crypto, console,
    require(name) { return load((name.startsWith("@/") ? resolve(root, name.slice(2)) : resolve(dirname(path), name)) + ".ts"); },
  });
  return exports;
}
const api = load(resolve(root, "lib/openai-candidates.ts"));
const mapping = load(resolve(root, "lib/video-workspace/candidate-generation.ts"));
const text = "My first business was a meal delivery service for office workers, and it failed because I built the app before asking customers what they needed. After six months I closed it, interviewed twenty potential customers, and learned to test whether people will pay before spending months building a product. That failure taught me to start with customer conversations and a small paid experiment, so I can discover a bad assumption before it becomes an expensive mistake. On another topic, I like to walk through the park every Sunday because the quiet time helps me relax after a busy week. My favorite route follows the river past the old bridge and ends at a cafe, where I read a book for half an hour before returning home. I also make vegetable soup at home by simmering carrots, onions, beans, and tomatoes for thirty minutes, then adding salt and fresh herbs. Making a large pot gives me lunch for several days, and freezing individual portions means I can have a quick meal without cooking every afternoon.";
const words = text.split(/\s+/).map((text, i) => ({ text, start: i * 650, end: i * 650 + 600 }));
const analysis = mapping.buildCandidateAnalysisInput({ words }, words.length * 650);
const checks = [
  { name: "supported-story", requirements: { mode: "specific", topic: "The first business failed and lessons learned", kind: "story" }, minimum: 1 },
  { name: "unsupported-claim", requirements: { mode: "specific", topic: "How the first business succeeded and raised ten million dollars", kind: "story" }, minimum: 0, maximum: 0 },
];
if (!process.argv.includes("--publish-only")) {
for (const check of checks) {
  const generated = await api.generateCandidatesWithOpenAI(analysis, { requirements: check.requirements, requestId: `publish-validation-${check.name}`, maxCandidates: 3 });
  const reviewed = await api.reviewCandidatesWithOpenAI(analysis, generated.candidates, { requirements: check.requirements, requestId: `publish-validation-${check.name}-review` });
  const candidates = mapping.alignAndValidateCandidateSet(reviewed.candidates, analysis.words, analysis.sourceDurationMs);
  assert.ok(candidates.candidates.length >= check.minimum, check.name);
  if (check.maximum !== undefined) assert.ok(candidates.candidates.length <= check.maximum, check.name);
  console.log(JSON.stringify({ validation: check.name, candidates: candidates.candidates.length, inputTokens: (generated.usage?.inputTokens ?? 0) + (reviewed.usage?.inputTokens ?? 0), outputTokens: (generated.usage?.outputTokens ?? 0) + (reviewed.usage?.outputTokens ?? 0) }));
}
await assert.rejects(api.generateCandidatesWithOpenAI(analysis, { requirements: { mode: "specific", topic: "Find frames where someone wears a red shirt and add background music", kind: "any" }, requestId: "publish-validation-capability" }), error => error.providerCode === "unsupported_selection");
console.log(JSON.stringify({ validation: "unsupported-capability", rejectedBeforeAnalysis: true }));

}

const publishApi = load(resolve(root, "lib/openai-publish.ts"));
const publishing = load(resolve(root, "lib/video-workspace/publish.ts"));
const materials = await publishApi.generatePublishMaterials("My first business failed because I built the app before speaking to customers. I learned to test demand through customer interviews and a small paid experiment before investing months in a product.", "publish-validation-materials");
const draft = publishing.parsePublishDraft(publishing.mergePublishDraft(null, materials.parsed, "fixture", "all"));
assert.equal(draft.titles.length, 3); assert.ok(draft.title.trim()); assert.ok(draft.body.trim()); assert.ok(draft.tags.length <= 5);
assert.ok(Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(draft.body)).length <= 3);
console.log(JSON.stringify({ validation: "publish-materials", titles: draft.titles.length, tags: draft.tags.length, inputTokens: materials.usage?.inputTokens, outputTokens: materials.usage?.outputTokens }));
