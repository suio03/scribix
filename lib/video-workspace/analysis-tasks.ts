import { AI_ANALYSIS, type AnalysisRange } from "./analysis-config";
import type { SelectionRequirements } from "./selection";
export type AnalysisTask = {
  id: string; project_id: string; user_id: string; request_id: string; transcript_id: string;
  requirements_json: string; range_json: string; input_key: string | null;
  status: string; phase: string; limited_reason: string | null; error_code: string | null;
  retryable: number; lease_token: string | null;
};
export type AnalysisTaskView = {
  id: string; requestId: string; status: string; phase: string; range: AnalysisRange;
  completedBatches: number; totalBatches: number; limitedReason: string | null;
  errorCode: string | null; canRetry: boolean;
  steps: Array<{ id: string; kind: string; status: string; error_code: string | null; ranges: AnalysisRange[] }>;
};
export async function latestAnalysisTask(db: D1Database, projectId: string, userId: string, requestId?: string): Promise<AnalysisTaskView | null> {
  const task = await db.prepare("SELECT * FROM ai_analysis_tasks WHERE project_id=?1 AND user_id=?2 AND (?3 IS NULL OR request_id=?3) ORDER BY created_at DESC, rowid DESC LIMIT 1").bind(projectId, userId, requestId ?? null).first<AnalysisTask>();
  if (!task) return null;
  const { results } = await db.prepare("SELECT id,kind,status,error_code,ranges_json FROM ai_analysis_steps WHERE task_id=?1 ORDER BY id").bind(task.id).all<AnalysisTaskView["steps"][number] & { ranges_json: string }>();
  const discovery = results.filter(s => s.kind === "discover" || s.kind === "supplement");
  return {
    id: task.id, requestId: task.request_id, status: task.status, phase: task.phase, range: JSON.parse(task.range_json),
    completedBatches: discovery.filter(s => s.status === "done").length, totalBatches: discovery.length,
    limitedReason: task.limited_reason, errorCode: task.error_code, canRetry: task.status === "failed" && Boolean(task.retryable), steps: results.map(({ ranges_json, ...step }) => ({ ...step, ranges: JSON.parse(ranges_json) }))
  };
}
export async function submitAnalysisTask(db: D1Database, input: {
  projectId: string; userId: string; transcriptId: string; requestId: string;
  requirements: SelectionRequirements; range: AnalysisRange; adjust: boolean;
}): Promise<string> {
  const existing = await db.prepare("SELECT id FROM ai_analysis_tasks WHERE project_id=?1 AND user_id=?2 AND request_id=?3").bind(input.projectId, input.userId, input.requestId).first<{ id: string }>();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  const insert = db.prepare(`INSERT INTO ai_analysis_tasks
    (id,project_id,user_id,transcript_id,request_id,requirements_json,range_json,algorithm_version,previous_selection_json)
    SELECT ?1,?2,?3,?4,?5,?6,?7,?8,json_object('requirements',p.selection_json,'requestId',p.selection_request_id,'outcome',p.selection_outcome,'adjustments',p.selection_adjustments) FROM video_projects p
    WHERE p.id=?2 AND p.user_id=?3 AND p.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM clip_candidates WHERE project_id=?2 AND origin='ai')
      AND NOT EXISTS (SELECT 1 FROM ai_analysis_tasks WHERE project_id=?2 AND status IN ('waiting','running','failed'))
      AND (p.selection_outcome IN ('idle','waiting','failed') OR (?9=1 AND p.selection_outcome='empty' AND p.selection_adjustments>0))
    ON CONFLICT DO NOTHING`).bind(id, input.projectId, input.userId, input.transcriptId, input.requestId, JSON.stringify(input.requirements), JSON.stringify(input.range), AI_ANALYSIS.version, input.adjust ? 1 : 0);
  const results = await db.batch([insert,
    db.prepare(`UPDATE video_projects SET selection_json=?1, selection_request_id=?2, selection_outcome='waiting',
      selection_adjustments=selection_adjustments-?3 WHERE id=?4 AND user_id=?5
      AND EXISTS(SELECT 1 FROM ai_analysis_tasks WHERE id=?6)`).bind(JSON.stringify(input.requirements), input.requestId, input.adjust ? 1 : 0, input.projectId, input.userId, id),
  ]);
  if (!results[0].meta.changes) {
    const duplicate = await db.prepare("SELECT id FROM ai_analysis_tasks WHERE project_id=?1 AND user_id=?2 AND request_id=?3").bind(input.projectId, input.userId, input.requestId).first<{ id: string }>();
    if (duplicate) return duplicate.id;
    throw new Error("candidate_generation_active");
  }
  return id;
}
export async function retryAnalysisTask(db: D1Database, projectId: string, userId: string, requestId: string): Promise<boolean> {
  const task = await db.prepare("SELECT * FROM ai_analysis_tasks WHERE project_id=?1 AND user_id=?2 AND request_id=?3 AND status='failed' AND retryable=1").bind(projectId, userId, requestId).first<AnalysisTask>();
  if (!task) return false;
  await db.batch([
    db.prepare("UPDATE ai_analysis_steps SET status='pending',attempts=0,error_code=NULL WHERE task_id=?1 AND status='failed' AND retryable=1").bind(task.id),
    db.prepare("UPDATE ai_analysis_tasks SET status='waiting',error_code=NULL,retryable=0,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status='failed'").bind(task.id),
  ]);
  return true;
}
// One atomic write reserves global and per-user capacity. Expired claims are fenced by tokens.
export async function claimAnalysisTask(db: D1Database): Promise<AnalysisTask | null> {
  const token = crypto.randomUUID();
  return db.prepare(`UPDATE ai_analysis_tasks SET lease_token=?1,lease_until=unixepoch()+?2,status='running',updated_at=CURRENT_TIMESTAMP
    WHERE id=(SELECT t.id FROM ai_analysis_tasks t JOIN video_projects p ON p.id=t.project_id
      WHERE t.status IN ('waiting','running') AND t.lease_until<=unixepoch() AND p.deleted_at IS NULL
      AND (SELECT COUNT(*) FROM ai_analysis_tasks a WHERE a.user_id=t.user_id AND a.lease_until>unixepoch())<?3
      ORDER BY t.updated_at,t.id LIMIT 1)
    AND (SELECT COUNT(*) FROM ai_analysis_tasks WHERE lease_until>unixepoch())<?4 RETURNING *`)
    .bind(token, AI_ANALYSIS.leaseSeconds, AI_ANALYSIS.userConcurrency, AI_ANALYSIS.globalConcurrency).first<AnalysisTask>();
}
