import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const bundled = await build({ entryPoints: ['lib/video-workspace/candidate-generation.ts'], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const { buildCandidateAnalysisInput } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const args = process.argv.slice(2); const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const input = option('--transcript'); const duration = Number(option('--duration-ms'));
const cases = input ? [{ name: 'supplied-transcript', duration, transcript: JSON.parse(await readFile(input, 'utf8')), synthetic: false }] : [30000, 1800000, 3600000, 10800000].flatMap(duration => ['sparse', 'dense'].map(density => ({ name: `${duration / 60000}m-${density}`, duration, synthetic: true, transcript: { words: Array.from({ length: Math.floor(duration / (density === 'dense' ? 200 : 1500)) }, (_, i) => ({ text: i % 12 === 11 ? 'Conclusion.' : 'spoken', start: i * (density === 'dense' ? 200 : 1500), end: i * (density === 'dense' ? 200 : 1500) + (density === 'dense' ? 180 : 1400) })) } })));
const rows = cases.map(item => {
  const started = performance.now(); const range = { startMs: Number(option('--start-ms') ?? 0), endMs: Number(option('--end-ms') ?? item.duration) };
  try {
    if (range.endMs - range.startMs > 10800000 || range.startMs < 0 || range.endMs > item.duration || range.startMs >= range.endMs) throw new Error('invalid_analysis_range');
    const analysis = buildCandidateAnalysisInput(item.transcript, item.duration, range);
    return { name: item.name, range, synthetic: item.synthetic, planningMs: performance.now() - started, batches: analysis.batches.length, maxBatchChars: Math.max(0, ...analysis.batches.map(b => b.text.length)), status: 'planned', discoveryCalls: 0, reviewed: null, finalCount: null, humanKeepCount: null, topicCoverage: null, candidateReadyMs: null, firstPreviewMs: null, framingMs: null, exportMs: null, actualCost: null, editorialAcceptance: false };
  } catch (error) { return { name: item.name, range, status: 'range_must_shrink', error: error.message, discoveryCalls: 0, editorialAcceptance: false }; }
});
const path = resolve(option('--output') ?? '/tmp/scribix-analysis-benchmark.json'); await mkdir(dirname(path), { recursive: true });
await writeFile(path, JSON.stringify({ kind: 'offline-planning-only', measuredAt: new Date().toISOString(), paidProviderCalls: 0, rows }, null, 2) + '\n'); console.log(path);
