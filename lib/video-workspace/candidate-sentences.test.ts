import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_CLIP_INPUT_CHAR_LIMIT,
  CandidateGenerationError,
  alignAndValidateCandidateSet,
  buildCandidateAnalysisInput,
  buildCandidateReviewInput,
  parseSentenceCandidateSet,
  parseSentenceCandidateReviewResult,
  shortlistSentenceCandidates,
} from "./candidate-generation";

function fixture(sentenceCount = 60) {
  const words = Array.from({ length: sentenceCount * 10 }, (_, index) => ({
    text: index % 10 === 9 ? "again." : "again",
    start: index * 1_000 + 123,
    end: index * 1_000 + 987,
    speaker: "A",
  }));
  return {
    words,
    sentences: Array.from({ length: sentenceCount }, (_, index) => ({
      text: "again ".repeat(9) + "again.",
      start: words[index * 10].start,
      end: words[index * 10 + 9].end,
    })),
  };
}

function proposal(start = "s10", end = "s12") {
  return { theme: "A useful idea", hook: "A complete opening", reason: "The excerpt stands alone.",
    score: 0.9, startSentenceId: start, endSentenceId: end };
}

function decision(candidateIndex: number, verdict: string, start: string | null, end: string | null) {
  return { candidateIndex, verdict, completenessScore: 0.9,
    completenessReason: "The spoken range includes its own context.", startSentenceId: start, endSentenceId: end };
}

test("repeated phrases map by stable IDs to exact words, not rounded display times", () => {
  const source = fixture();
  const analysis = buildCandidateAnalysisInput(source, 600_000);
  assert.deepEqual(buildCandidateAnalysisInput(source, 600_000), analysis);
  assert.equal(analysis.sentences.length, 60);
  assert.equal(analysis.sentences[10].firstWordIndex, 100);
  assert.equal(analysis.sentences[12].lastWordIndex, 129);
  assert.match(analysis.text, /s10\|100.1-110.0\|A\|again/);
  assert.doesNotMatch(analysis.text, /100123-100987:again/);
  const set = parseSentenceCandidateSet({ candidates: [proposal()] }, analysis.sentences);
  assert.deepEqual(set.candidates[0].segments, [{ startMs: 100_123, endMs: 129_987 }]);
  const final = alignAndValidateCandidateSet(set, analysis.words, 600_000);
  assert.deepEqual(final.candidates[0].segments, set.candidates[0].segments);
});

test("invalid IDs, missing intermediate sentences, reversed and overlong ranges are rejected", () => {
  const analysis = buildCandidateAnalysisInput(fixture(), 600_000);
  for (const candidate of [proposal("s010", "s12"), proposal("s999", "s1000"),
    proposal("s12", "s10"), proposal("s0", "s5"), proposal("s0", "s0"),
    { ...proposal(), startMs: 100_123 }]) {
    assert.throws(() => parseSentenceCandidateSet({ candidates: [candidate] }, analysis.sentences), CandidateGenerationError);
  }
  assert.throws(() => parseSentenceCandidateSet({ candidates: [proposal()] },
    analysis.sentences.filter((sentence) => sentence.id !== "s11")), CandidateGenerationError);
});

test("review contains only local sentence text, deduplicates context, and keeps original IDs", () => {
  const analysis = buildCandidateAnalysisInput(fixture(), 600_000);
  const proposed = parseSentenceCandidateSet({ candidates: [proposal(), proposal("s12", "s14")] }, analysis.sentences);
  const context = buildCandidateReviewInput(analysis, proposed);
  assert.ok(context.text.includes("s10|"));
  assert.ok(!context.text.includes("s59|"));
  assert.equal(context.text.split("s12|").length - 1, 1);
  assert.ok(!context.text.includes(proposed.candidates[0].reason));
  assert.doesNotMatch(context.text, /100123-100987:again/);
  assert.ok(context.text.length < analysis.text.length);
});

test("review can accept, extend a sentence range, or reject with null IDs", () => {
  const analysis = buildCandidateAnalysisInput(fixture(), 600_000);
  const proposed = parseSentenceCandidateSet({ candidates: [proposal(), proposal("s20", "s22"), proposal("s40", "s42")] }, analysis.sentences);
  const context = buildCandidateReviewInput(analysis, proposed);
  const reviewed = parseSentenceCandidateReviewResult({ reviews: [
    decision(2, "reject", null, null), decision(0, "accept", "s10", "s12"), decision(1, "adjust", "s19", "s22"),
  ] }, proposed, context);
  assert.equal(reviewed.candidates.candidates.length, 2);
  assert.deepEqual(reviewed.candidates.candidates[1].segments, [{ startMs: 190_123, endMs: 229_987 }]);
});

test("review rejects cross-candidate context jumps, altered accepts, duplicates and missing decisions", () => {
  const analysis = buildCandidateAnalysisInput(fixture(), 600_000);
  const proposed = parseSentenceCandidateSet({ candidates: [proposal(), proposal("s40", "s42")] }, analysis.sentences);
  const context = buildCandidateReviewInput(analysis, proposed);
  const valid = decision(1, "accept", "s40", "s42");
  for (const bad of [decision(0, "adjust", "s40", "s42"), decision(0, "adjust", "s6", "s8"),
    decision(0, "accept", "s9", "s12"), decision(0, "reject", "s10", "s12"),
    decision(0, "adjust", "s9", "s14"), decision(-1, "reject", null, null)]) {
    assert.throws(() => parseSentenceCandidateReviewResult({ reviews: [bad, valid] }, proposed, context), CandidateGenerationError);
  }
  assert.throws(() => parseSentenceCandidateReviewResult({ reviews: [valid] }, proposed, context), CandidateGenerationError);
  assert.throws(() => parseSentenceCandidateReviewResult({ reviews: [valid, valid] }, proposed, context), CandidateGenerationError);
});

test("sentence fallback keeps every word once and uses punctuation when annotations are absent or partial", () => {
  const source = fixture(6);
  for (const annotations of [undefined, source.sentences.slice(0, 2)]) {
    const analysis = buildCandidateAnalysisInput({ words: source.words, sentences: annotations }, 60_000);
    assert.equal(analysis.sentences.length, 6);
    assert.deepEqual(analysis.sentences.flatMap((sentence) => analysis.words.slice(
      sentence.firstWordIndex, sentence.lastWordIndex + 1
    )), analysis.words);
  }
});

test("exact sentence annotations preserve abbreviation punctuation and speaker changes split turns", () => {
  const source = fixture(3);
  source.words[1].text = "Dr.";
  const analysis = buildCandidateAnalysisInput(source, 30_000);
  assert.equal(analysis.sentences.length, 3);
  source.words[5].speaker = "B";
  assert.equal(buildCandidateAnalysisInput(source, 30_000).sentences[1].speaker, "B");
});

test("oversized transcripts use contiguous overlapping batches without dropping words", () => {
  const source = fixture(90);
  source.words.forEach((word, index) => { word.text = "x".repeat(350) + (index % 10 === 9 ? "." : ""); });
  const analysis = buildCandidateAnalysisInput(source, 900_000);
  assert.ok(analysis.batches.length > 1);
  assert.equal(analysis.truncated, false);
  const seen = new Set(analysis.batches.flatMap((batch) => batch.sentences.map((sentence) => sentence.id)));
  assert.equal(seen.size, analysis.sentences.length);
  for (const [index, batch] of analysis.batches.entries()) {
    assert.ok(batch.text.length <= AI_CLIP_INPUT_CHAR_LIMIT);
    assert.ok(batch.sentences.every((sentence, offset) => sentence.index === batch.sentences[0].index + offset));
    if (index) {
      const previous = analysis.batches[index - 1].sentences;
      assert.ok(previous[previous.length - 1].endMs - batch.sentences[0].startMs >= 45_000);
    }
  }
});

test("an oversized sentence fails explicitly rather than truncating reference text", () => {
  assert.throws(() => buildCandidateAnalysisInput({
    words: [{ text: "x".repeat(AI_CLIP_INPUT_CHAR_LIMIT), start: 0, end: 20_000 }],
  }), (error: unknown) => error instanceof CandidateGenerationError && error.code === "analysis_input_too_large");
});

test("batch shortlisting removes overlap duplicates and preserves the strongest candidates", () => {
  const analysis = buildCandidateAnalysisInput(fixture(), 600_000);
  const parsed = parseSentenceCandidateSet({ candidates: [proposal(), proposal(), proposal("s40", "s42")] }, analysis.sentences);
  parsed.candidates[1].score = 0.5;
  assert.equal(shortlistSentenceCandidates(parsed.candidates, 5).candidates.length, 2);
  assert.equal(shortlistSentenceCandidates(parsed.candidates, 1).candidates[0].score, 0.9);
});


test("overlapping speech preserves source IDs and the whole selected word range", () => {
  const analysis = buildCandidateAnalysisInput({ words: [
    { text: "First.", start: 0, end: 30_000, speaker: "A" },
    { text: "Second.", start: 10_000, end: 20_000, speaker: "B" },
    { text: "Third.", start: 31_000, end: 40_000, speaker: "A" },
  ] }, 60_000);
  const proposed = parseSentenceCandidateSet({ candidates: [proposal("s0", "s1")] }, analysis.sentences);
  assert.deepEqual(proposed.candidates[0].segments, [{ startMs: 0, endMs: 30_000 }]);
  const context = buildCandidateReviewInput(analysis, proposed);
  assert.ok(context.text.includes('"endSentenceId":"s1"'));
  const reviewed = parseSentenceCandidateReviewResult({ reviews: [decision(0, "accept", "s0", "s1")] }, proposed, context);
  assert.equal(reviewed.candidates.candidates[0].sentenceRange?.endSentenceId, "s1");
  assert.throws(() => parseSentenceCandidateReviewResult({ reviews: [decision(0, "accept", "s0", "s0")] }, proposed, context));
  const final = alignAndValidateCandidateSet(reviewed.candidates, analysis.words, 60_000);
  assert.ok(!("sentenceRange" in final.candidates[0]), "request-local IDs are not persisted");
});
