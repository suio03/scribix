import { latestAnalysisTask, submitAnalysisTask, retryAnalysisTask } from "@/lib/video-workspace/analysis-tasks";
import { parseAnalysisRange } from "@/lib/video-workspace/analysis-config";
import { DEFAULT_SELECTION, parseSelection, type SelectionRequirements, type SelectionState } from "@/lib/video-workspace/selection";
import { recoverProjectRenderQueue } from "@/lib/video-workspace/render-scheduling";
import { auth } from "@/auth";
import type { AaiTranscript } from "@/lib/aai";
import { prepareAiUsageEvent, type AiTokenUsage } from "@/lib/ai-usage";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser, type CurrentUserRow } from "@/lib/current-user";
import {
  OPENAI_CANDIDATE_MODEL,
  OpenAICandidateError,
  generateCandidatesWithOpenAI,
  reviewCandidatesWithOpenAI,
} from "@/lib/openai-candidates";
import {
  CandidateGenerationError,
  DIRECT_EDIT_MAX_SOURCE_DURATION_MS,
  aiCandidateGenerationBlocked,
  alignAndValidateCandidateSet,
  buildCandidateAnalysisInput,
  candidateLimitForSourceDuration,
} from "@/lib/video-workspace/candidate-generation";
import {
  createManualClipCandidate,
  listClipCandidates,
  replaceClipCandidates,
} from "@/lib/video-workspace/candidates";
import { videoWorkspaceAccessFor } from "@/lib/video-workspace/access";
import {
  listCandidatePreviews,
  queueAutomaticCandidatePreviews,
  queueCandidatePreviews,
} from "@/lib/video-workspace/preview-jobs";

type Params = { params: Promise<{ id: string }> };

type CandidateProjectRow = {
  id: string;
  status: string;
  transcript_id: string;
  transcript_status: string;
  transcript_r2_key: string | null;
  source_duration_ms: number | null;
  source_status: string | null;
  source_expires_at: string | null;
  updated_at: string;
  selection_json: string | null;
  selection_request_id: string | null;
  selection_outcome: SelectionState["outcome"];
  selection_adjustments: number;
};

export async function GET(_: Request, { params }: Params) {
  const context = await candidateContext(params);
  if (context instanceof Response) return context;
  await recoverProjectRenderQueue(context.env.DB, context.env.VIDEO_RENDER_QUEUE, context.user.id, context.project.id)
    .catch(() => console.error(JSON.stringify({ event: "video_scheduler_recovery_failed", projectId: context.project.id })));
  const [allCandidates, allPreviews] = await Promise.all([
    listClipCandidates(context.env.DB, context.user.id, context.project.id),
    listCandidatePreviews(context.env.DB, context.user.id, context.project.id),
  ]);
  const task = await latestAnalysisTask(context.env.DB, context.project.id, context.user.id);
  const taskActive = task && ["waiting", "running"].includes(task.status);
  const access = videoWorkspaceAccessFor(context.user.tier);
  const candidates = access.canEditClips
    ? allCandidates
    : allCandidates.filter((candidate) => candidate.origin === "ai");
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const previews = allPreviews.filter((preview) => candidateIds.has(preview.candidateId));
  return Response.json({
    batchAnalysisEnabled: context.env.AI_CLIPS_BATCH_ENABLED === "true",
    task,
    status: context.project.transcript_status === "error" ? "transcript_failed" : taskActive ? (context.project.transcript_status === "completed" ? "analyzing" : "waiting") : task?.status === "failed" ? "failed" : context.project.selection_outcome === "waiting" ? "waiting" : effectiveProjectStatus(context.project),
    transcriptReady: context.project.transcript_status === "completed",
    transcriptId: context.project.transcript_id,
    selection: { ...selectionState(context.project), ...(taskActive ? {outcome: context.project.transcript_status === "completed" ? "running" : "waiting"} : task?.status === "failed" ? {outcome:"failed"} : {}) },
    candidates,
    previews,
  });
}

export async function POST(request: Request, { params }: Params) {
  const context = await candidateContext(params);
  if (context instanceof Response) return context;
  const { env, project, user } = context;

  if (
    project.source_status !== "ready" ||
    sourceExpired(project.source_expires_at)
  ) {
    return Response.json({ error: "source_video_missing" }, { status: 410 });
  }

  let body: { mode?: unknown; requirements?: unknown; requestId?: unknown; adjust?: unknown; analysisRange?: unknown; retry?: unknown } = {};
  try {
    if (request.headers.get("content-type")?.includes("application/json")) body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch { return Response.json({ error: "invalid_candidate_request" }, { status: 400 }); }
  const mode = body.mode ?? "ai";
  if (mode !== "ai" && mode !== "manual") return Response.json({ error: "invalid_candidate_request" }, { status: 400 });
  let requirements: SelectionRequirements;
  try { requirements = parseSelection(body.requirements); }
  catch { return Response.json({ error: "invalid_selection" }, { status: 400 }); }
  if ((body.requestId !== undefined && (typeof body.requestId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(body.requestId))) ||
      (body.adjust !== undefined && typeof body.adjust !== "boolean") ||
      (body.retry !== undefined && typeof body.retry !== "boolean")) return Response.json({ error: "invalid_candidate_request" }, { status: 400 });
  const executionId = typeof body.requestId === "string" && /^[a-zA-Z0-9_-]{8,100}$/.test(body.requestId)
    ? body.requestId : crypto.randomUUID();
  const access = videoWorkspaceAccessFor(user.tier);
  if (mode === "manual" && !access.canEditClips) {
    return Response.json({ error: "upgrade_required" }, { status: 402 });
  }
  const requestedTask = mode === "ai" && typeof body.requestId === "string" ? await latestAnalysisTask(env.DB, project.id, user.id, body.requestId) : null;
  if (requestedTask) {
    if (body.retry === true) await retryAnalysisTask(env.DB, project.id, user.id, requestedTask.requestId);
    await env.AI_CLIPS_QUEUE.send({wake:true}).catch(() => {});
    const snapshot = await (await GET(request,{params})).json() as Record<string, unknown>;
    return Response.json({...snapshot,task:await latestAnalysisTask(env.DB,project.id,user.id,requestedTask.requestId)},{status:202});
  }
  if (body.retry === true) return Response.json({error:"analysis_task_not_found"},{status:404});
  const currentTask = mode === "ai" ? await latestAnalysisTask(env.DB, project.id, user.id) : null;
  const useBatch = mode === "ai" && !(access.canEditClips && project.source_duration_ms && project.source_duration_ms <= DIRECT_EDIT_MAX_SOURCE_DURATION_MS);
  if (currentTask && ["waiting","running","failed"].includes(currentTask.status)) return Response.json({error:"candidate_generation_active"},{status:409});
  if (useBatch && env.AI_CLIPS_BATCH_ENABLED === "true") {
    let range;
    try {range = parseAnalysisRange(body.analysisRange,project.source_duration_ms ?? 0);}
    catch {return Response.json({error:"invalid_analysis_range"},{status:400});}
    if (project.transcript_status === "completed" && project.transcript_r2_key) {
      const object = await env.SCRIBIX_MEDIA.get(project.transcript_r2_key);
      if (!object) return Response.json({error:"word_timestamps_missing"},{status:422});
      try {buildCandidateAnalysisInput(await object.json() as AaiTranscript,project.source_duration_ms,range);}
      catch(error) {return Response.json({error:error instanceof CandidateGenerationError ? error.code : "invalid_candidate_request"},{status:422});}
    }
    try {
      await submitAnalysisTask(env.DB,{projectId:project.id,userId:user.id,transcriptId:project.transcript_id,requestId:executionId,requirements,range,adjust:body.adjust===true});
    } catch {return Response.json({error:"candidate_generation_active"},{status:409});}
    await env.AI_CLIPS_QUEUE.send({wake:true}).catch(() => {});
    const response = await GET(request,{params});
    return new Response(response.body,{status:202,headers:response.headers});
  }
  if (body.analysisRange !== undefined) return Response.json({error:"batch_analysis_disabled"},{status:409});
  if (mode === "ai" && project.status === "analyzing" && !candidateGenerationStale(project.updated_at)) {
    return Response.json({ error: "candidate_generation_active" }, { status: 409 });
  }
  if (project.transcript_status !== "completed" || !project.transcript_r2_key) {
    if (mode === "manual") return Response.json({ error: "transcript_not_ready" }, { status: 409 });
    await env.DB.prepare(`UPDATE video_projects SET selection_json = ?1, selection_request_id = ?2, selection_outcome = 'waiting'
      WHERE id = ?3 AND user_id = ?4 AND deleted_at IS NULL AND selection_outcome = 'idle'`)
      .bind(JSON.stringify(requirements), executionId, project.id, user.id).run();
    return GET(request, { params });
  }
  const sourceDurationMs = project.source_duration_ms;
  if (!sourceDurationMs || sourceDurationMs < 250) {
    return Response.json({ error: "source_video_missing" }, { status: 410 });
  }
  const existingCandidates = await listClipCandidates(env.DB, user.id, project.id);
  if (mode === "ai" && aiCandidateGenerationBlocked(
    project.selection_outcome === "matched" ? "candidates_ready" : project.status === "candidates_ready" ? "draft" : project.status,
    existingCandidates.map((candidate) => candidate.origin)
  )) {
    return Response.json({ error: "candidates_already_generated" }, { status: 409 });
  }
  if (
    access.canEditClips &&
    (mode === "manual" || sourceDurationMs <= DIRECT_EDIT_MAX_SOURCE_DURATION_MS)
  ) {
    const candidateId = await createManualClipCandidate(
      env.DB,
      user.id,
      project.id,
      sourceDurationMs,
      DIRECT_EDIT_MAX_SOURCE_DURATION_MS
    );
    try {
      await queueCandidatePreviews(
        env.DB,
        env.VIDEO_RENDER_QUEUE,
        user.id,
        project.id,
        candidateId
      );
    } catch (error) {
      console.error(JSON.stringify({
        event: "video_preview_auto_queue_failed",
        projectId: project.id,
        error: error instanceof Error ? error.name : "unknown",
      }));
    }
    const [candidates, previews] = await Promise.all([
      listClipCandidates(env.DB, user.id, project.id),
      listCandidatePreviews(env.DB, user.id, project.id),
    ]);
    return Response.json({ status: "editing", candidates, previews, candidateId });
  }

  const previousSelection = selectionState(project);
  if (project.selection_request_id === executionId && ["matched", "empty"].includes(project.selection_outcome)) {
    return GET(request, { params });
  }
  const adjustment = body.adjust === true;
  if (adjustment && (project.selection_outcome !== "empty" || !project.selection_adjustments)) {
    return Response.json({ error: "selection_locked" }, { status: 409 });
  }
  if (!adjustment && project.selection_outcome === "empty") {
    return GET(request, { params });
  }
  // Failed/stale executions can retry only the same stored direction.
  if (!adjustment && project.selection_json) requirements = parseSelection(JSON.parse(project.selection_json));
  const claimed = await env.DB.prepare(
    `UPDATE video_projects
        SET status = 'analyzing', updated_at = CURRENT_TIMESTAMP,
            selection_json = ?3, selection_request_id = ?4, selection_outcome = 'running',
            selection_adjustments = selection_adjustments - ?5
      WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL
        AND selection_outcome = ?6 AND selection_adjustments = ?7
        AND selection_request_id IS ?8
        AND (status IN ('draft', 'candidates_ready', 'failed')
          OR (status = 'analyzing' AND updated_at < datetime('now', '-10 minutes')))
        AND NOT EXISTS (SELECT 1 FROM clip_candidates WHERE project_id = ?1 AND origin = 'ai')`
  ).bind(project.id, user.id, JSON.stringify(requirements), executionId, adjustment ? 1 : 0,
    project.selection_outcome, project.selection_adjustments, project.selection_request_id).run();
  if (!claimed.meta?.changes) return Response.json({ error: "candidate_generation_active" }, { status: 409 });

  const requestId = `clips_${crypto.randomUUID()}`;
  const reviewRequestId = `${requestId}_review`;
  let providerResult: Awaited<ReturnType<typeof generateCandidatesWithOpenAI>> | null = null;
  let reviewResult: Awaited<ReturnType<typeof reviewCandidatesWithOpenAI>> | null = null;
  let stage: "generation" | "review" | "persistence" = "generation";
  try {
    const transcriptObject = await env.SCRIBIX_MEDIA.get(project.transcript_r2_key);
    if (!transcriptObject) {
      throw new CandidateGenerationError(
        "Transcript object is missing",
        "word_timestamps_missing"
      );
    }
    const transcript = (await transcriptObject.json()) as AaiTranscript;
    const analysisInput = buildCandidateAnalysisInput(
      transcript,
      project.source_duration_ms
    );
    const cacheKey = await promptCacheKey(project.transcript_id);
    providerResult = await generateCandidatesWithOpenAI(analysisInput, {
      requestId,
      requirements,
      promptCacheKey: cacheKey,
      maxCandidates: candidateLimitForSourceDuration(analysisInput.sourceDurationMs),
    });
    await recordUsageBestEffort({
      db: env.DB,
      feature: "video_candidate_generation",
      requestId,
      requestStatus: "success",
      user,
      transcriptId: project.transcript_id,
      providerResponseId: providerResult.responseId,
      serviceTier: providerResult.serviceTier,
      usage: providerResult.usage,
    });
    stage = "review";
    reviewResult = await reviewCandidatesWithOpenAI(
      analysisInput,
      providerResult.candidates,
      {
        requestId: reviewRequestId,
        requirements,
        promptCacheKey: cacheKey,
      }
    );
    await recordUsageBestEffort({
      db: env.DB,
      feature: "video_candidate_completeness_review",
      requestId: reviewRequestId,
      requestStatus: "success",
      user,
      transcriptId: project.transcript_id,
      providerResponseId: reviewResult.responseId,
      serviceTier: reviewResult.serviceTier,
      usage: reviewResult.usage,
    });
    console.info(JSON.stringify({
      event: "video_candidate_completeness_review_completed",
      requestId: reviewRequestId,
      projectId: project.id,
      proposedCount: providerResult.candidates.candidates.length,
      acceptedCount: reviewResult.reviews.filter((review) => review.verdict === "accept").length,
      adjustedCount: reviewResult.reviews.filter((review) => review.verdict === "adjust").length,
      rejectedCount: reviewResult.reviews.filter((review) => review.verdict === "reject").length,
    }));
    stage = "persistence";
    const candidateSet = alignAndValidateCandidateSet(
      reviewResult.candidates,
      analysisInput.words,
      analysisInput.sourceDurationMs
    );
    const committed = await replaceClipCandidates(env.DB, user.id, project.id, candidateSet, executionId);
    if (!committed) return GET(request, { params });
    const candidates = await listClipCandidates(env.DB, user.id, project.id);
    try {
      await queueAutomaticCandidatePreviews(
        env.DB,
        env.VIDEO_RENDER_QUEUE,
        user.id,
        project.id
      );
    } catch (error) {
      console.error(JSON.stringify({
        event: "video_preview_auto_queue_failed",
        requestId,
        projectId: project.id,
        error: error instanceof Error ? error.name : "unknown",
      }));
    }
    const previews = await listCandidatePreviews(env.DB, user.id, project.id);
    return Response.json({
      status: "candidates_ready",
      candidates,
      previews,
      transcriptTruncated: analysisInput.truncated,
      selection: { requirements, requestId: executionId, outcome: candidates.length ? "matched" : "empty", adjustmentsRemaining: project.selection_adjustments - (adjustment ? 1 : 0) },
    });
  } catch (error) {
    const providerError = error instanceof OpenAICandidateError ? error : null;
    await restoreProjectStatus(
      env.DB,
      user.id,
      project.id,
      existingCandidates.length > 0,
      executionId
    );
    if (providerError?.providerCode === "unsupported_selection") {
      await env.DB.prepare(`UPDATE video_projects SET selection_json = ?1, selection_request_id = ?2, selection_outcome = ?3, selection_adjustments = ?4 WHERE id = ?5 AND user_id = ?6 AND selection_request_id = ?7`).bind(project.selection_json, project.selection_request_id, previousSelection.outcome, project.selection_adjustments, project.id, user.id, executionId).run();
    }
    if (stage !== "persistence") {
      const failedResult = stage === "review" ? reviewResult : providerResult;
      await recordUsageBestEffort({
        db: env.DB,
        feature: stage === "review"
          ? "video_candidate_completeness_review"
          : "video_candidate_generation",
        requestId: stage === "review" ? reviewRequestId : requestId,
        requestStatus: "failed",
        user,
        transcriptId: project.transcript_id,
        providerResponseId: providerError?.responseId ?? failedResult?.responseId,
        providerErrorCode:
          providerError?.providerCode ??
          (error instanceof CandidateGenerationError ? error.code : "unknown"),
        serviceTier: providerError?.serviceTier ?? failedResult?.serviceTier,
        usage: providerError?.usage ?? failedResult?.usage,
      });
    }
    console.error(JSON.stringify({
      event: "video_candidates_failed",
      requestId,
      projectId: project.id,
      transcriptId: project.transcript_id,
      errorCode:
        providerError?.providerCode ??
        (error instanceof CandidateGenerationError
          ? error.code
          : stage === "persistence"
            ? "persistence_failed"
            : stage === "review"
              ? "completeness_review_failed"
              : "unknown"),
    }));
    return providerError?.providerCode === "unsupported_selection"
      ? Response.json({ error: "unsupported_selection" }, { status: 422 })
      : candidateErrorResponse(error, requestId);
  }
}

function selectionState(project: CandidateProjectRow): SelectionState {
  return {
    requirements: project.selection_json ? parseSelection(JSON.parse(project.selection_json)) : DEFAULT_SELECTION,
    requestId: project.selection_request_id,
    outcome: project.selection_outcome === "running" && candidateGenerationStale(project.updated_at) ? "failed" : project.selection_outcome,
    adjustmentsRemaining: project.selection_adjustments,
  };
}

async function candidateContext(params: Params["params"]): Promise<
  | {
      env: CloudflareEnv;
      project: CandidateProjectRow;
      user: CurrentUserRow;
    }
  | Response
> {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const project = await env.DB.prepare(
    `SELECT p.id, p.status, p.transcript_id,
            t.status AS transcript_status, t.transcript_r2_key,
            a.duration_ms AS source_duration_ms,
            a.status AS source_status, a.expires_at AS source_expires_at,
            p.updated_at, p.selection_json, p.selection_request_id, p.selection_outcome, p.selection_adjustments
       FROM video_projects p
       JOIN transcripts t
         ON t.id = p.transcript_id AND t.user_id = p.user_id
       LEFT JOIN media_assets a
         ON a.id = p.source_asset_id AND a.user_id = p.user_id
      WHERE p.id = ?1
        AND p.user_id = ?2
        AND p.deleted_at IS NULL
        AND t.deleted_at IS NULL`
  )
    .bind(id, user.id)
    .first<CandidateProjectRow>();
  return project
    ? { env, project, user }
    : Response.json({ error: "not_found" }, { status: 404 });
}

async function restoreProjectStatus(
  db: D1Database,
  userId: string,
  projectId: string,
  hasCandidates: boolean,
  executionId: string
): Promise<void> {
  await db.prepare(
    `UPDATE video_projects
        SET status = ?1, selection_outcome = 'failed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?2 AND user_id = ?3 AND status = 'analyzing' AND selection_request_id = ?4`
  )
    .bind(hasCandidates ? "candidates_ready" : "failed", projectId, userId, executionId)
    .run();
}

function candidateErrorResponse(error: unknown, requestId: string): Response {
  if (error instanceof CandidateGenerationError) {
    if (error.code === "word_timestamps_missing") {
      return Response.json({ error: error.code, requestId }, { status: 422 });
    }
    return Response.json({ error: "candidate_output_invalid", requestId }, { status: 502 });
  }
  if (
    error instanceof OpenAICandidateError &&
    (error.status === 401 || error.status === 403 || !process.env.OPENAI_API_KEY)
  ) {
    return Response.json({ error: "candidate_service_unavailable", requestId }, { status: 503 });
  }
  return Response.json({ error: "candidate_generation_failed", requestId }, { status: 502 });
}

async function promptCacheKey(transcriptId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(transcriptId)
  );
  const value = Array.from(new Uint8Array(digest).slice(0, 24))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `video-candidates:${value}`;
}

function sourceExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const value = expiresAt.includes("T")
    ? expiresAt
    : `${expiresAt.replace(" ", "T")}Z`;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function effectiveProjectStatus(project: CandidateProjectRow): string {
  return project.status === "analyzing" && candidateGenerationStale(project.updated_at)
    ? "failed"
    : project.status;
}

function candidateGenerationStale(updatedAt: string): boolean {
  const value = updatedAt.includes("T")
    ? updatedAt
    : `${updatedAt.replace(" ", "T")}Z`;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now() - 10 * 60 * 1000;
}

async function recordUsageBestEffort({
  db,
  feature,
  requestId,
  requestStatus,
  user,
  transcriptId,
  providerResponseId,
  providerErrorCode,
  serviceTier,
  usage,
}: {
  db: D1Database;
  feature: "video_candidate_generation" | "video_candidate_completeness_review";
  requestId: string;
  requestStatus: "success" | "failed";
  user: CurrentUserRow;
  transcriptId: string;
  providerResponseId?: string | null;
  providerErrorCode?: string | null;
  serviceTier?: string | null;
  usage?: AiTokenUsage | null;
}): Promise<void> {
  if (!usage) return;
  try {
    await prepareAiUsageEvent(db, {
      feature,
      requestStatus,
      requestId,
      providerResponseId,
      providerErrorCode,
      model: OPENAI_CANDIDATE_MODEL,
      serviceTier,
      userId: user.id,
      transcriptId,
      planTier: user.tier,
      billingCycle: user.billing_cycle,
      usage,
    }).run();
  } catch (error) {
    console.error(JSON.stringify({
      event: "ai_usage_write_failed",
      feature,
      requestId,
      error: error instanceof Error ? error.name : "unknown",
    }));
  }
}
