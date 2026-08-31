import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { presignOwnedAssetGet } from "@/lib/video-workspace/asset-access";
import {
  candidatePreview,
  queueCandidatePreviews,
  rebuildCandidatePreviewSegment,
} from "@/lib/video-workspace/preview-jobs";

type Params = { params: Promise<{ id: string; candidateId: string }> };

export async function GET(_: Request, { params }: Params) {
  const context = await previewContext(params);
  if (context instanceof Response) return context;
  const { candidateId } = await params;
  const preview = await candidatePreview(
    context.env.DB,
    context.userId,
    context.projectId,
    candidateId
  );
  if (!preview) {
    return Response.json({ status: "not_requested", segments: [] });
  }
  const segments = await Promise.all(preview.segments.map(async (segment) => {
    if (segment.jobStatus !== "completed" || segment.assetStatus !== "ready") {
      return { ...segment, url: null, expiresInSec: null };
    }
    const access = await presignOwnedAssetGet(
      context.env.DB,
      context.userId,
      context.projectId,
      segment.assetId
    );
    return access.ok
      ? { ...segment, url: access.url, expiresInSec: access.expiresInSec }
      : { ...segment, url: null, expiresInSec: null };
  }));
  return Response.json({ ...preview, segments });
}

export async function POST(request: Request, { params }: Params) {
  const context = await previewContext(params);
  if (context instanceof Response) return context;
  const { candidateId } = await params;
  let body: {
    segmentIndex?: unknown;
    sourceStartMs?: unknown;
    sourceEndMs?: unknown;
  } = {};
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }
  }
  const rebuildRequested = body.segmentIndex !== undefined ||
    body.sourceStartMs !== undefined || body.sourceEndMs !== undefined;
  const result = rebuildRequested
    ? await rebuildCandidatePreviewSegment(
        context.env.DB,
        context.env.VIDEO_RENDER_QUEUE,
        context.userId,
        context.projectId,
        candidateId,
        Number(body.segmentIndex),
        Number(body.sourceStartMs),
        Number(body.sourceEndMs)
      )
    : await queueCandidatePreviews(
        context.env.DB,
        context.env.VIDEO_RENDER_QUEUE,
        context.userId,
        context.projectId,
        candidateId
      );
  if (!result.ok) {
    const status = ["candidate_not_found", "project_not_found", "segment_not_found"].includes(result.error)
      ? 404
      : result.error === "invalid_segment_range"
        ? 400
        : 410;
    return Response.json({ error: result.error }, { status });
  }
  const preview = await candidatePreview(
    context.env.DB,
    context.userId,
    context.projectId,
    candidateId
  );
  const created = typeof result.created === "number" ? result.created > 0 : result.created;
  return Response.json({ ...result, preview }, { status: created ? 202 : 200 });
}

async function previewContext(params: Params["params"]): Promise<
  | { env: CloudflareEnv; userId: string; projectId: string }
  | Response
> {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const project = await env.DB.prepare(
    `SELECT id FROM video_projects
      WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
  )
    .bind(id, user.id)
    .first<{ id: string }>();
  return project
    ? { env, userId: user.id, projectId: project.id }
    : Response.json({ error: "not_found" }, { status: 404 });
}
