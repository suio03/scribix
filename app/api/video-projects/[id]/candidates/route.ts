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
  alignAndValidateCandidateSet,
  buildCandidateAnalysisInput,
  candidateLimitForSourceDuration,
} from "@/lib/video-workspace/candidate-generation";
import {
  listClipCandidates,
  replaceClipCandidates,
  replaceWithManualClipCandidate,
} from "@/lib/video-workspace/candidates";
import {
  listCandidatePreviews,
  queueAutomaticCandidatePreviews,
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
};

export async function GET(_: Request, { params }: Params) {
  const context = await candidateContext(params);
  if (context instanceof Response) return context;
  const [candidates, previews] = await Promise.all([
    listClipCandidates(context.env.DB, context.user.id, context.project.id),
    listCandidatePreviews(context.env.DB, context.user.id, context.project.id),
  ]);
  return Response.json({
    status: effectiveProjectStatus(context.project),
    candidates,
    previews,
  });
}

export async function POST(request: Request, { params }: Params) {
  const context = await candidateContext(params);
  if (context instanceof Response) return context;
  const { env, project, user } = context;

  if (
    project.transcript_status !== "completed" ||
    !project.transcript_r2_key
  ) {
    return Response.json({ error: "transcript_not_ready" }, { status: 409 });
  }
  if (
    project.source_status !== "ready" ||
    sourceExpired(project.source_expires_at)
  ) {
    return Response.json({ error: "source_video_missing" }, { status: 410 });
  }
  if (project.status === "analyzing" && !candidateGenerationStale(project.updated_at)) {
    return Response.json({ error: "candidate_generation_active" }, { status: 409 });
  }

  const mode = await candidateRequestMode(request);
  if (mode instanceof Response) return mode;
  const sourceDurationMs = project.source_duration_ms;
  if (!sourceDurationMs || sourceDurationMs < 250) {
    return Response.json({ error: "source_video_missing" }, { status: 410 });
  }
  if (mode === "manual" || sourceDurationMs <= DIRECT_EDIT_MAX_SOURCE_DURATION_MS) {
    await replaceWithManualClipCandidate(
      env.DB,
      user.id,
      project.id,
      sourceDurationMs,
      DIRECT_EDIT_MAX_SOURCE_DURATION_MS
    );
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
        projectId: project.id,
        error: error instanceof Error ? error.name : "unknown",
      }));
    }
    const [candidates, previews] = await Promise.all([
      listClipCandidates(env.DB, user.id, project.id),
      listCandidatePreviews(env.DB, user.id, project.id),
    ]);
    return Response.json({ status: "editing", candidates, previews });
  }

  const existingCandidates = await listClipCandidates(env.DB, user.id, project.id);
  const claimed = await env.DB.prepare(
    `UPDATE video_projects
        SET status = 'analyzing', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1
        AND user_id = ?2
        AND deleted_at IS NULL
        AND (
          status IN ('draft', 'candidates_ready', 'editing', 'failed')
          OR (status = 'analyzing' AND updated_at < datetime('now', '-10 minutes'))
        )`
  )
    .bind(project.id, user.id)
    .run();
  if (!claimed.meta?.changes) {
    return Response.json({ error: "invalid_project_state" }, { status: 409 });
  }

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
    providerResult = await generateCandidatesWithOpenAI(analysisInput.text, {
      requestId,
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
      analysisInput.text,
      providerResult.candidates,
      {
        requestId: reviewRequestId,
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
    await replaceClipCandidates(env.DB, user.id, project.id, candidateSet);
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
    });
  } catch (error) {
    const providerError = error instanceof OpenAICandidateError ? error : null;
    await restoreProjectStatus(
      env.DB,
      user.id,
      project.id,
      existingCandidates.length > 0
    );
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
    return candidateErrorResponse(error, requestId);
  }
}

async function candidateRequestMode(
  request: Request
): Promise<"ai" | "manual" | Response> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return "ai";
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "invalid_candidate_request" }, { status: 400 });
  }
  const mode = (body as { mode?: unknown }).mode;
  return mode === undefined || mode === "ai"
    ? "ai"
    : mode === "manual"
      ? "manual"
      : Response.json({ error: "invalid_candidate_request" }, { status: 400 });
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
            p.updated_at
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
  hasCandidates: boolean
): Promise<void> {
  await db.prepare(
    `UPDATE video_projects
        SET status = ?1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?2 AND user_id = ?3 AND status = 'analyzing'`
  )
    .bind(hasCandidates ? "candidates_ready" : "failed", projectId, userId)
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
