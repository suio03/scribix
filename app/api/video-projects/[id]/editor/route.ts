import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { videoWorkspaceAccessFor } from "@/lib/video-workspace/access";
import {
  loadEditorWorkspace,
  saveProjectDraft,
  snapshotProjectDraft,
} from "@/lib/video-workspace/editor";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const context = await editorContext(params);
  if (context instanceof Response) return context;
  if (!context.canEdit) return upgradeRequired();
  const candidateId = new URL(request.url).searchParams.get("candidateId");
  if (!candidateId) {
    return Response.json({ error: "candidate_id_required" }, { status: 400 });
  }
  const result = await loadEditorWorkspace(
    context.env.DB,
    context.env.SCRIBIX_MEDIA,
    context.userId,
    context.projectId,
    candidateId
  );
  if (!result.ok) {
    const status = result.error === "project_not_found" || result.error === "candidate_not_found"
      ? 404
      : result.error === "source_video_missing"
        ? 410
        : 409;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json(result.workspace);
}

export async function PUT(request: Request, { params }: Params) {
  const context = await editorContext(params);
  if (context instanceof Response) return context;
  if (!context.canEdit) return upgradeRequired();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  const result = await saveProjectDraft(
    context.env.DB,
    context.userId,
    context.projectId,
    body.candidateId,
    body.expectedRevision,
    body.edl,
    body.renderSpec
  );
  if (!result.ok) {
    const status = result.error === "draft_conflict"
      ? 409
      : result.error === "project_not_found" || result.error === "candidate_not_found"
        ? 404
        : result.error === "source_video_missing"
          ? 410
          : 400;
    return Response.json(result, { status });
  }
  return Response.json(result);
}

export async function POST(request: Request, { params }: Params) {
  const context = await editorContext(params);
  if (context instanceof Response) return context;
  if (!context.canEdit) return upgradeRequired();
  let body: { candidateId?: unknown; expectedRevision?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    typeof body.candidateId !== "string" ||
    !Number.isInteger(body.expectedRevision) ||
    Number(body.expectedRevision) < 0
  ) {
    return Response.json({ error: "invalid_snapshot_request" }, { status: 400 });
  }
  const result = await snapshotProjectDraft(
    context.env.DB,
    context.userId,
    context.projectId,
    body.candidateId,
    Number(body.expectedRevision)
  );
  if (!result.ok) {
    const status = result.error === "draft_conflict" ? 409 : result.error === "project_not_found" ? 404 : 400;
    return Response.json(result, { status });
  }
  return Response.json(result, { status: 201 });
}

async function editorContext(params: Params["params"]): Promise<
  | { env: CloudflareEnv; userId: string; projectId: string; canEdit: boolean }
  | Response
> {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  return user
    ? {
        env,
        userId: user.id,
        projectId: id,
        canEdit: videoWorkspaceAccessFor(user.tier).canEditClips,
      }
    : Response.json({ error: "user_not_found" }, { status: 404 });
}

function upgradeRequired(): Response {
  return Response.json({ error: "upgrade_required" }, { status: 402 });
}

async function readBody(request: Request): Promise<
  | { candidateId: string; expectedRevision: number; edl: unknown; renderSpec: unknown }
  | Response
> {
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    typeof body.candidateId !== "string" ||
    !Number.isInteger(body.expectedRevision) ||
    Number(body.expectedRevision) < 0 ||
    !body.edl ||
    !body.renderSpec
  ) {
    return Response.json({ error: "invalid_draft_request" }, { status: 400 });
  }
  return {
    candidateId: body.candidateId,
    expectedRevision: Number(body.expectedRevision),
    edl: body.edl,
    renderSpec: body.renderSpec,
  };
}
