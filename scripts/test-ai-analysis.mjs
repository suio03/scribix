import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

// Real workerd, local D1 and R2. Provider requests are mocked; never paid calls.
const bundled = await build({
stdin: {
contents: `
import {runAnalysisTurn} from './lib/video-workspace/analysis-runner';
import worker from './workers/ai-clips';
import {replaceClipCandidates} from './lib/video-workspace/candidates';
import {submitAnalysisTask,retryAnalysisTask,claimAnalysisTask,latestAnalysisTask} from './lib/video-workspace/analysis-tasks';
import {parseAnalysisRange} from './lib/video-workspace/analysis-config';
import {buildCandidateAnalysisInput} from './lib/video-workspace/candidate-generation';
export default {async fetch(request,env) {
 const body=await request.json();
 try {
 let result;
 if(body.action==='turn') result=await runAnalysisTurn(env);
 if(body.action==='queue'){let ack=0;let retry=0;await worker.queue({messages:[{ack(){ack++;},retry(){retry++;}}]},env);result={ack,retry};}
 if(body.action==='cron'){await worker.scheduled({},env);result=true;}
 if(body.action==='submit') result=await submitAnalysisTask(env.DB,body.input);
 if(body.action==='retry') result=await retryAnalysisTask(env.DB,'p','u','request_1');
 if(body.action==='claim') result=await claimAnalysisTask(env.DB);
 if(body.action==='commit') result=await replaceClipCandidates(env.DB,'u','p',{schemaVersion:1,candidates:[{schemaVersion:1,id:body.candidateId,theme:'Complete point',hook:'Faithful',reason:'Complete',score:1,segments:[{startMs:0,endMs:20000}]}]},'request_1',body.fence);
 if(body.action==='status') result=await latestAnalysisTask(env.DB,'p','u');
 if(body.action==='range') result=parseAnalysisRange(body.range,body.duration);
 if(body.action==='plan') {const range=parseAnalysisRange(body.range,body.duration);const plan=buildCandidateAnalysisInput(body.transcript,body.duration,range);result=plan.batches.map(b=>({chars:b.text.length,start:b.sentences[0]?.startMs,end:b.sentences.at(-1)?.endMs}));}
 return Response.json({result});
 } catch(e) {return Response.json({error:e.message},{status:400});}
}}`, resolveDir: process.cwd()
}, bundle: true, write: false, format: "esm", platform: "browser", target: "es2022", external: ["node:*"], logLevel: "silent"
});
const baseSchema = `
CREATE TABLE users(id TEXT PRIMARY KEY,tier TEXT DEFAULT 'free',billing_cycle TEXT);
CREATE TABLE transcripts(id TEXT PRIMARY KEY,user_id TEXT,status TEXT,transcript_r2_key TEXT,deleted_at TEXT,webhook_token TEXT,reserved_minutes INTEGER,processing_limit_sec INTEGER,submit_started_at TEXT,aai_transcript_id TEXT);
CREATE TABLE video_projects(id TEXT PRIMARY KEY,user_id TEXT,transcript_id TEXT,source_asset_id TEXT,deleted_at TEXT,status TEXT DEFAULT 'draft',selection_json TEXT,selection_request_id TEXT,selection_outcome TEXT DEFAULT 'idle',selection_adjustments INTEGER DEFAULT 1,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE media_assets(id TEXT PRIMARY KEY,user_id TEXT,project_id TEXT,kind TEXT,r2_key TEXT,mime_type TEXT,status TEXT,duration_ms INTEGER,expires_at TEXT,deleted_at TEXT,auto_framing_json TEXT);
CREATE TABLE clip_candidates(id TEXT PRIMARY KEY,user_id TEXT,project_id TEXT,rank INTEGER,theme TEXT,hook TEXT,reason TEXT,score REAL,segments_json TEXT,origin TEXT DEFAULT 'ai',status TEXT DEFAULT 'suggested',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE render_jobs(id TEXT PRIMARY KEY,user_id TEXT,project_id TEXT,project_version_id TEXT,candidate_id TEXT,segment_index INTEGER,segment_id TEXT,source_start_ms INTEGER,source_end_ms INTEGER,proxy_source_start_ms INTEGER,proxy_source_end_ms INTEGER,proxy_version INTEGER,kind TEXT,preset_id TEXT,scope_key TEXT,status TEXT,idempotency_key TEXT UNIQUE,output_asset_id TEXT,queued_at TEXT,provider_job_id TEXT);
`;
async function fixture(t) {
  let requests = 0; let failures = 0; let handler = () => ({ candidates: [] });
  const outboundService = async request => {
    assert.equal(new URL(request.url).origin, 'https://api.openai.com');
    if (failures > 0) { failures--; return new Response('unavailable', { status: 503 }); }
    requests++; const body = await request.json();
    return Response.json({ id: `r${requests}`, status: 'completed', output_text: JSON.stringify(handler(body)), usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } });
  };
  const mf = new Miniflare({ modules: true, script: bundled.outputFiles[0].text, compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat", "nodejs_compat_populate_process_env"], bindings: { OPENAI_API_KEY: "test-only" }, d1Databases: ["DB"], r2Buckets: ["SCRIBIX_MEDIA"], queueProducers: { AI_CLIPS_QUEUE: "analysis", VIDEO_RENDER_QUEUE: "render" }, outboundService });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB"); const r2 = await mf.getR2Bucket("SCRIBIX_MEDIA");
  for (const sql of (baseSchema + readFileSync("migrations/0024_ai_usage_events.sql", "utf8") + readFileSync("migrations/0042_ai_analysis_tasks.sql", "utf8") + readFileSync("migrations/0043_clip_review_mark.sql", "utf8")).split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(sql).run();
  await db.batch([
    db.prepare("INSERT INTO users(id) VALUES ('u')"), db.prepare("INSERT INTO transcripts(id,user_id,status,transcript_r2_key) VALUES ('t','u','completed','transcript')"),
    db.prepare("INSERT INTO video_projects(id,user_id,transcript_id,source_asset_id) VALUES ('p','u','t','source')"),
    db.prepare("INSERT INTO media_assets(id,user_id,project_id,kind,status,duration_ms) VALUES ('source','u','p','source','ready',1800000)"),
  ]);
  const transcript = { words: Array.from({ length: 1800 }, (_, i) => ({ text: i % 10 === 9 ? 'end.' : 'word', start: i * 1000, end: i * 1000 + 900 })) };
  await r2.put('transcript', JSON.stringify(transcript));
  const call = async (action, data = {}) => { const response = await mf.dispatchFetch('http://local.test/', { method: 'POST', body: JSON.stringify({ action, ...data }) }); return response.json(); };
  const input = { projectId: 'p', userId: 'u', transcriptId: 't', requestId: 'request_1', requirements: { mode: 'auto', topic: '', kind: 'all' }, range: { startMs: 0, endMs: 1800000 }, adjust: false };
  const respond = value => { handler = value; };
  return { db, r2, call, input, respond, failures: n => { failures = n; }, requests: () => requests, transcript };
}
test('180-minute range boundary, no silent truncation, dense planning fails before calls', async t => {
  const f = await fixture(t);
  assert.deepEqual((await f.call('range', { duration: 10800000 })).result, { startMs: 0, endMs: 10800000 });
  for (const data of [{ duration: 10800001 }, { duration: 20000, range: { startMs: -1, endMs: 1000 } }, { duration: 20000, range: { startMs: 0, endMs: 20001 } }, { duration: 20000, range: { startMs: 1000, endMs: 1000 } }]) assert.ok((await f.call('range', data)).error);
  const dense = { words: Array.from({ length: 400 }, (_, i) => ({ text: 'x'.repeat(4000) + '.', start: i * 1000, end: i * 1000 + 900 })) };
  assert.ok((await f.call('plan', { transcript: dense, duration: 400000 })).error);
  const plan = (await f.call('plan', { transcript: f.transcript, duration: 1800000, range: { startMs: 100000, endMs: 1600000 } })).result;
  assert.ok(plan.length > 2); for (const b of plan) { assert.ok(b.chars <= 20000); assert.ok(b.start >= 100000 && b.end <= 1600000); assert.ok(b.end - b.start <= 600000); }
  assert.equal(f.requests(), 0);
});
test('duplicate submissions, queue redelivery, saved steps and final commit are idempotent', async t => {
  const f = await fixture(t); f.respond(() => ({ candidates: [] }));
  const submissions = await Promise.all(Array.from({ length: 5 }, () => f.call('submit', { input: f.input })));
  assert.equal(new Set(submissions.map(s => s.result)).size, 1); assert.ok(submissions[0].result);
  assert.ok((await f.call('submit', { input: { ...f.input, requestId: 'request_2' } })).error);
  for (let i = 0; i < 15; i++)await f.call('turn');
  const status = (await f.call('status')).result; assert.equal(status.status, 'completed'); assert.equal(status.completedBatches, status.totalBatches);
  const calls = f.requests(); for (let i = 0; i < 4; i++)await f.call('turn'); assert.equal(f.requests(), calls);
  assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM ai_analysis_attempts').first()).n, calls);
});
test('waiting transcript starts without browser, expired lease is recovered, concurrency is atomic', async t => {
  const f = await fixture(t); f.respond(() => ({ candidates: [] }));
  await f.db.prepare("UPDATE transcripts SET status='processing'").run(); await f.call('submit', { input: f.input }); await f.call('turn'); assert.equal(f.requests(), 0);
  const first = (await f.call('claim')).result; assert.ok(first.lease_token); assert.equal((await f.call('claim')).result, null);
  await f.db.prepare("UPDATE ai_analysis_tasks SET lease_until=unixepoch()-1").run(); await f.db.prepare("UPDATE transcripts SET status='completed'").run();
  for (let i = 0; i < 15; i++)await f.call('turn'); assert.equal((await f.call('status')).result.status, 'completed');
  for (let i = 0; i < 8; i++) {
    await f.db.prepare("INSERT INTO video_projects(id,user_id,transcript_id,source_asset_id) VALUES (?1,?2,'t','source')").bind(`p${i}`, i < 4 ? 'u' : 'v').run();
    await f.call('submit', { input: { ...f.input, projectId: `p${i}`, userId: i < 4 ? 'u' : 'v' } });
  }
  const claims = (await Promise.all(Array.from({ length: 15 }, () => f.call('claim')))).map(r => r.result).filter(Boolean);
  assert.equal(claims.length, 4); assert.equal(claims.filter(c => c.user_id === 'u').length, 2);
});
test('a step that fails twice is skipped and the task completes with the remaining sections', async t => {
  const f = await fixture(t); await f.call('submit', { input: f.input }); await f.call('turn');
  f.failures(3);
  f.respond(() => ({ candidates: [] }));
  for (let i = 0; i < 15; i++)await f.call('turn');
  const status = (await f.call('status')).result; assert.equal(status.status, 'completed'); assert.equal(status.canRetry, false);
  assert.equal(status.limitedReason, 'partial_analysis'); assert.equal(status.steps.filter(s => s.status === 'failed').length, 1);
});
test('when every discovery section fails the task stays retryable and retry runs only unfinished steps', async t => {
  const f = await fixture(t); await f.call('submit', { input: f.input }); await f.call('turn');
  const total = (await f.db.prepare("SELECT COUNT(*) n FROM ai_analysis_steps WHERE kind='discover'").first()).n;
  f.failures(total * 2);
  f.respond(() => ({ candidates: [] }));
  for (let i = 0; i < 15; i++)await f.call('turn');
  const failed = (await f.call('status')).result; assert.equal(failed.status, 'failed'); assert.equal(failed.canRetry, true); assert.equal(failed.completedBatches, 0);
  const calls = f.requests(); assert.equal((await f.call('retry')).result, true);
  for (let i = 0; i < 15; i++)await f.call('turn'); assert.equal((await f.call('status')).result.status, 'completed'); assert.equal(f.requests(), calls + total);
});
test('90-second candidates are reviewed and committed once, manual clips survive and only five previews warm', async t => {
  const f = await fixture(t); await f.call('submit', { input: f.input });
  await f.db.prepare("INSERT INTO clip_candidates(id,user_id,project_id,rank,origin,segments_json) VALUES ('manual','u','p',99,'manual','[]')").run();
  f.respond(request => {
    if (request.text.format.name === 'analysis_topic_groups') return { groups: JSON.parse(request.input[0].content[0].text).map(c => [c.index]), topics:[JSON.parse(request.input[0].content[0].text).map(c=>c.index)] };
    if (request.text.format.name === 'video_clip_sentence_completeness_review') {
      const refs = JSON.parse(request.input[0].content[0].text.split('CANDIDATES TO REVIEW (context is not automatically included in a clip):\n')[1].split('\nProposed metadata')[0]);
      return { reviews: refs.map(c => ({ candidateIndex: c.candidateIndex, verdict: 'accept', completenessScore: 1, completenessReason: 'complete', startSentenceId: c.startSentenceId, endSentenceId: c.endSentenceId, theme: 'Faithful title', hook: 'Faithful hook' })) };
    }
    const ids = [...request.input[0].content[0].text.matchAll(/^(s\d+)\|/gm)].map(m => m[1]);
    return { candidates: [0, 10, 20].filter(i => ids[i + 8]).map((i, index) => ({ theme: `Topic ${ids[i]}`, hook: 'A complete point', reason: 'Complete', score: .9 - index * .1, startSentenceId: ids[i], endSentenceId: ids[i + 8] })) };
  });
  for (let i = 0; i < 30; i++)await f.call('turn');
  const status = (await f.call('status')).result; assert.equal(status.status, 'completed', JSON.stringify(status));
  assert.equal((await f.db.prepare("SELECT COUNT(*) n FROM clip_candidates WHERE origin='manual'").first()).n, 1);
  const candidates = await f.db.prepare("SELECT * FROM clip_candidates WHERE origin='ai'").all(); assert.ok(candidates.results.length > 5);
  assert.ok(candidates.results.every(c => JSON.parse(c.segments_json)[0].endMs - JSON.parse(c.segments_json)[0].startMs > 60000));
  assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM render_jobs').first()).n, 5);
  for (let i = 0; i < 3; i++)await f.call('turn'); assert.equal((await f.db.prepare("SELECT COUNT(*) n FROM clip_candidates WHERE origin='ai'").first()).n, candidates.results.length);
});
test('when every review fails the task stays retryable instead of committing an empty result', async t => {
  const f = await fixture(t); await f.call('submit', { input: f.input });
  let reviewsFail = true;
  f.respond(request => {
    if (request.text.format.name === 'analysis_topic_groups') return { groups: JSON.parse(request.input[0].content[0].text).map(c => [c.index]), topics: [] };
    if (request.text.format.name === 'video_clip_sentence_completeness_review') {
      if (reviewsFail) return { reviews: 'malformed' };
      const refs = JSON.parse(request.input[0].content[0].text.split('CANDIDATES TO REVIEW (context is not automatically included in a clip):\n')[1].split('\nProposed metadata')[0]);
      return { reviews: refs.map(c => ({ candidateIndex: c.candidateIndex, verdict: 'accept', completenessScore: 1, completenessReason: 'complete', startSentenceId: c.startSentenceId, endSentenceId: c.endSentenceId, theme: 'Faithful title', hook: 'Faithful hook' })) };
    }
    const ids = [...request.input[0].content[0].text.matchAll(/^(s\d+)\|/gm)].map(m => m[1]);
    return { candidates: ids[8] ? [{ theme: `Topic ${ids[0]}`, hook: 'A complete point', reason: 'Complete', score: .9, startSentenceId: ids[0], endSentenceId: ids[8] }] : [] };
  });
  for (let i = 0; i < 40; i++)await f.call('turn');
  const failed = (await f.call('status')).result;
  assert.equal(failed.status, 'failed', JSON.stringify(failed)); assert.equal(failed.canRetry, true);
  assert.notEqual((await f.db.prepare("SELECT selection_outcome FROM video_projects WHERE id='p'").first()).selection_outcome, 'empty');
  const discoveries = (await f.db.prepare("SELECT COUNT(*) n FROM ai_analysis_attempts a JOIN ai_analysis_steps s ON s.task_id=a.task_id AND s.id=a.step_id WHERE s.kind IN ('discover','supplement')").first()).n;
  reviewsFail = false; assert.equal((await f.call('retry')).result, true);
  for (let i = 0; i < 40; i++)await f.call('turn');
  assert.equal((await f.call('status')).result.status, 'completed');
  assert.ok((await f.db.prepare("SELECT COUNT(*) n FROM clip_candidates WHERE origin='ai'").first()).n > 0);
  assert.equal((await f.db.prepare("SELECT COUNT(*) n FROM ai_analysis_attempts a JOIN ai_analysis_steps s ON s.task_id=a.task_id AND s.id=a.step_id WHERE s.kind IN ('discover','supplement')").first()).n, discoveries);
});
test('R2 result survives a failed step write without repeating a provider request', async t => {
  const f = await fixture(t); f.respond(() => ({ candidates: [] })); await f.call('submit', { input: f.input }); await f.call('turn'); await f.call('turn');
  const step = await f.db.prepare("SELECT * FROM ai_analysis_steps WHERE id='d000'").first(); assert.equal(step.status, 'done');
  await f.db.prepare("UPDATE ai_analysis_steps SET status='running',result_key=NULL WHERE id='d000'").run();
  const before = f.requests(); await f.call('queue'); assert.equal(f.requests(), before); assert.equal((await f.db.prepare("SELECT status FROM ai_analysis_steps WHERE id='d000'").first()).status, 'done');
});
test('actual discovery attempts are capped and skipped ranges remain visibly limited', async t => {
  const f = await fixture(t); f.respond(() => ({ candidates: [] })); await f.call('submit', { input: f.input }); await f.call('turn');
  const task = await f.db.prepare('SELECT id FROM ai_analysis_tasks').first();
  await f.db.batch(Array.from({ length: 60 }, (_, i) => f.db.prepare("INSERT INTO ai_analysis_attempts(id,task_id,step_id,status) VALUES (?1,?2,'d000','failed')").bind(`used-${i}`, task.id)));
  for (let i = 0; i < 15; i++)await f.call('turn'); const result = (await f.call('status')).result;
  assert.equal(result.status, 'completed'); assert.equal(result.limitedReason, 'discovery_budget'); assert.equal(result.completedBatches, 0); assert.equal(f.requests(), 0); assert.ok(result.steps.every(s => s.status === 'limited' && s.ranges.length === 1));
});
test('unsupported selection stops discovery and restores the zero-match adjustment', async t => {
  const f = await fixture(t); await f.db.prepare("UPDATE video_projects SET selection_outcome='empty'").run();
  f.respond(() => ({ supported: false })); await f.call('submit', { input: { ...f.input, adjust: true, requirements: { mode: 'specific', topic: 'recognize faces', kind: 'all' } } });
  for (let i = 0; i < 6; i++)await f.call('turn'); const task = (await f.call('status')).result;
  assert.equal(task.status, 'rejected'); assert.equal(f.requests(), 1);
  const project = await f.db.prepare('SELECT * FROM video_projects').first(); assert.equal(project.selection_adjustments, 1); assert.equal(project.selection_outcome, 'empty');
  assert.ok((await f.call('submit', { input: { ...f.input, requestId: 'request_2', adjust: true } })).result);
});
test('scheduled recovery purges expired project analysis artifacts without touching unrelated R2 objects', async t => {
  const f = await fixture(t); await f.call('submit', { input: f.input }); await f.call('turn');
  const task = await f.db.prepare('SELECT * FROM ai_analysis_tasks').first(); assert.ok(await f.r2.get(task.input_key)); await f.r2.put('unrelated', 'keep');
  await f.db.prepare("UPDATE video_projects SET deleted_at=CURRENT_TIMESTAMP").run(); assert.equal((await f.call('cron')).result, true);
  assert.equal(await f.r2.get(task.input_key), null); assert.ok(await f.r2.get('unrelated'));
  assert.equal((await f.db.prepare('SELECT status FROM ai_analysis_tasks').first()).status, 'expired');
});
test('saturated originals finish before one level of binary supplements', async t => {
  const f = await fixture(t); await f.call('submit', { input: f.input });
  f.respond(request => {
    const text = request.input[0].content[0].text;
    if (request.text.format.name === 'analysis_topic_groups') return { groups: JSON.parse(text).map(c => [c.index]), topics: [JSON.parse(text).map(c => c.index)] };
    if (request.text.format.name === 'video_clip_sentence_completeness_review') {
      const refs = JSON.parse(text.split('CANDIDATES TO REVIEW (context is not automatically included in a clip):\n')[1].split('\nProposed metadata')[0]);
      return { reviews: refs.map(c => ({ candidateIndex: c.candidateIndex, verdict: 'reject', completenessScore: 0, completenessReason: 'Not self-contained', startSentenceId: null, endSentenceId: null, theme: null, hook: null })) };
    }
    if (text.includes('Already discovered ranges;')) return { candidates: [] };
    const ids = [...text.matchAll(/^(s\d+)\|/gm)].map(m => m[1]);
    return { candidates: Array.from({ length: 12 }, (_, i) => i * 2).filter(i => ids[i + 1]).map(i => ({ theme: 'Point', hook: 'Hook', reason: 'Reason', score: .8, startSentenceId: ids[i], endSentenceId: ids[i + 1] })) };
  });
  for (let i = 0; i < 70; i++)await f.call('turn'); const status = (await f.call('status')).result; assert.equal(status.status, 'completed');
  const kinds = (await f.db.prepare('SELECT s.kind FROM ai_analysis_attempts a JOIN ai_analysis_steps s ON s.task_id=a.task_id AND s.id=a.step_id ORDER BY a.rowid').all()).results.map(s => s.kind);
  assert.deepEqual(kinds.slice(0, 4), Array(4).fill('discover')); assert.equal(kinds.filter(k => k === 'supplement').length, 8); assert.ok(kinds.length < 60);
});
test('an expired lease cannot commit candidates or overwrite a saved result', async t => {
 const f=await fixture(t);await f.call('submit',{input:f.input});
 const first=(await f.call('claim')).result;
 await f.db.prepare('UPDATE ai_analysis_tasks SET lease_until=unixepoch()-1').run();
 const second=(await f.call('claim')).result;
 await f.db.prepare("UPDATE video_projects SET selection_outcome='running'").run();
 assert.equal((await f.call('commit',{candidateId:'stale',fence:{taskId:first.id,token:first.lease_token}})).result,false);
 assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM clip_candidates').first()).n,0);
 assert.equal((await f.call('commit',{candidateId:'current',fence:{taskId:second.id,token:second.lease_token}})).result,true);
 await f.db.prepare("UPDATE clip_candidates SET theme='User saved draft' WHERE id='current'").run();
 assert.equal((await f.call('commit',{candidateId:'duplicate',fence:{taskId:second.id,token:second.lease_token}})).result,false);
 assert.equal((await f.db.prepare("SELECT theme FROM clip_candidates WHERE id='current'").first()).theme,'User saved draft');
});
test('a waiting task rejects an over-budget transcript without model calls and can choose a smaller range',async t=>{
 const f=await fixture(t);await f.call('submit',{input:f.input});
 await f.r2.put('transcript',JSON.stringify({words:Array.from({length:400},(_,i)=>({text:'x'.repeat(4000)+'.',start:i*1000,end:i*1000+900}))}));
 await f.call('turn');assert.equal((await f.call('status')).result.status,'rejected');assert.equal(f.requests(),0);
 assert.ok((await f.call('submit',{input:{...f.input,requestId:'request_2',range:{startMs:0,endMs:20000}}})).result);
});
test('a malformed model response is retried per step instead of failing the task permanently', async t => {
  const f = await fixture(t); await f.call('submit', { input: f.input }); await f.call('turn');
  let malformed = 1;
  f.respond(() => malformed-- > 0 ? { candidates: [{ theme: 'x' }] } : { candidates: [] });
  for (let i = 0; i < 15; i++)await f.call('turn');
  assert.equal((await f.call('status')).result.status, 'completed');
  assert.equal((await f.db.prepare("SELECT COUNT(*) n FROM ai_analysis_attempts WHERE error_code='invalid_candidate_payload'").first()).n, 1);
});
