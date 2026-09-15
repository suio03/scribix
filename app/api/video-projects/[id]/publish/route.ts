import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { prepareAiUsageEvent } from "@/lib/ai-usage";
import { OPENAI_CANDIDATE_MODEL, OpenAICandidateError } from "@/lib/openai-candidates";
import { generatePublishMaterials } from "@/lib/openai-publish";
import { videoWorkspaceAccessFor } from "@/lib/video-workspace/access";
import { loadEditorWorkspace, saveProjectDraft } from "@/lib/video-workspace/editor";
import { PUBLISH_LIMITS, mergePublishDraft, parsePublishDraft, publishContent, publishContentKey, type PublishDraft } from "@/lib/video-workspace/publish";
import type { TitleOverlay } from "@/lib/video-workspace/contracts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "not_found" }, { status: 404 });
  if (!videoWorkspaceAccessFor(user.tier).canEditClips) return Response.json({ error: "upgrade_required" }, { status: 402 });
  const { id } = await params;
  let body: { candidateId?: string; expectedRevision?: number; mode?: "all" | "titles" | "copy" };
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
  if (!body || typeof body.candidateId !== "string" || !Number.isInteger(body.expectedRevision) || !["all", "titles", "copy"].includes(body.mode ?? "all")) return Response.json({ error: "invalid_request" }, { status: 400 });
  const result = await loadEditorWorkspace(env.DB, env.SCRIBIX_MEDIA, user.id, id, body.candidateId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.error === "source_video_missing" ? 410 : 404 });
  const workspace = result.workspace;
  if (workspace.revision !== body.expectedRevision) return Response.json({ error: "draft_conflict" }, { status: 409 });
  const mode = body.mode ?? "all";
  if (mode === "all" && workspace.publishDraft) return Response.json(workspace);
  const input = publishContent(workspace.edl, workspace.renderSpec);
  if (!input.trim() || input.length > 30_000) return Response.json({ error: "content_missing" }, { status: 422 });
  const executionId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  // Single atomic statement protects concurrency and the rolling-minute quota. Only five timestamps are retained.
  const claimed = await env.DB.prepare(`INSERT INTO publish_generation_limits (user_id, execution_id, lease_until, window_start, attempts, request_times_json)
    VALUES (?1, ?2, ?3, ?4, 1, json_array(?4))
    ON CONFLICT(user_id) DO UPDATE SET execution_id = ?2, lease_until = ?3,
      attempts = (SELECT COUNT(*) + 1 FROM json_each(request_times_json) WHERE value > ?4 - 60),
      request_times_json = json_insert((SELECT json_group_array(value) FROM json_each(request_times_json) WHERE value > ?4 - 60), '$[#]', ?4),
      window_start = ?4
    WHERE lease_until <= ?4 AND (SELECT COUNT(*) FROM json_each(request_times_json) WHERE value > ?4 - 60) < ?5`)
    .bind(user.id, executionId, now + PUBLISH_LIMITS.leaseSeconds, now, PUBLISH_LIMITS.perMinute).run();
  if (!claimed.meta.changes) return Response.json({ error: "generation_busy" }, { status: 429 });
  let generated: Awaited<ReturnType<typeof generatePublishMaterials>> | null = null;
  try {
    generated = await generatePublishMaterials(input, executionId);
    const draft = parsePublishDraft(mergePublishDraft(workspace.publishDraft, generated.parsed as PublishDraft, publishContentKey(workspace.edl, workspace.renderSpec), mode));
    if (!draft || draft.titles.length !== 3 || draft.titles.some(title => !title.trim()) || !draft.title.trim() || !draft.body.trim()) throw new Error("invalid_output");
    const generatedBody = (generated.parsed as { body: string }).body;
    if (Array.from(new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(generatedBody)).filter(sentence => sentence.segment.trim()).length > 3) throw new Error("invalid_output");
    const spec = { ...workspace.renderSpec };
    const overlay = (text: string): TitleOverlay => ({ enabled: true, text, durationMs: 3000, fontScale: 1, positionY: 0.22, color: workspace.renderSpec.brand.templateId ? workspace.renderSpec.brand.accentColor : "#FFFFFF" });
    if (mode !== "copy" && !draft.edited.opening && !(spec.openingTitle && !workspace.publishDraft)) spec.openingTitle = { ...(spec.openingTitle ?? overlay(draft.titles[0])), text: draft.titles[0] };
    if (!spec.coverTitle) spec.coverTitle = overlay(spec.openingTitle?.text ?? draft.titles[0]);
    const lease = await env.DB.prepare("SELECT execution_id FROM publish_generation_limits WHERE user_id = ?1 AND execution_id = ?2 AND lease_until > ?3").bind(user.id, executionId, Math.floor(Date.now() / 1000)).first();
    if (!lease) return Response.json({ error: "generation_expired" }, { status: 409 });
    const saved = await saveProjectDraft(env.DB, user.id, id, body.candidateId, workspace.revision, workspace.edl, spec, draft, executionId);
    if (!saved.ok) return Response.json({ error: saved.error }, { status: saved.error === "draft_conflict" ? 409 : 400 });
    return Response.json({ ...workspace, renderSpec: spec, publishDraft: draft, revision: saved.revision, restoredDraft: true });
  } catch (error) {
    if (error instanceof OpenAICandidateError && error.usage) generated = { parsed: null, responseId: error.responseId ?? null, serviceTier: error.serviceTier ?? null, usage: error.usage };
    return Response.json({ error: "publish_generation_failed" }, { status: 502 });
  } finally {
    await env.DB.prepare("UPDATE publish_generation_limits SET lease_until = 0 WHERE user_id = ?1 AND execution_id = ?2").bind(user.id, executionId).run();
    if (generated?.usage) await prepareAiUsageEvent(env.DB, {
      feature: "video_publish_generation", requestId: executionId, requestStatus: generated.parsed ? "success" : "failed",
      model: OPENAI_CANDIDATE_MODEL, providerResponseId: generated.responseId, serviceTier: generated.serviceTier,
      userId: user.id, planTier: user.tier, billingCycle: user.billing_cycle, usage: generated.usage,
    }).run().catch(() => console.error(JSON.stringify({ event: "ai_usage_write_failed", requestId: executionId })));
  }
}
