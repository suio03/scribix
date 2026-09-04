import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { presignGet } from "@/lib/r2";
import { videoWorkspaceAccessFor } from "@/lib/video-workspace/access";
import {
  createBrandAssetUpload,
  listBrandAssets,
  type BrandAssetKind,
} from "@/lib/video-workspace/brand-assets";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const context = await assetContext(params);
  if (context instanceof Response) return context;
  const assets = await listBrandAssets(
    context.env.DB,
    context.userId,
    context.projectId,
    presignGet
  );
  return Response.json({ assets });
}

export async function POST(request: Request, { params }: Params) {
  const context = await assetContext(params);
  if (context instanceof Response) return context;
  let body: { kind?: unknown; mimeType?: unknown; bytes?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    (body.kind !== "logo" && body.kind !== "font") ||
    typeof body.mimeType !== "string" ||
    !Number.isInteger(body.bytes)
  ) {
    return Response.json({ error: "invalid_asset_request" }, { status: 400 });
  }
  const result = await createBrandAssetUpload(
    context.env.DB,
    context.userId,
    context.projectId,
    body.kind as BrandAssetKind,
    body.mimeType,
    Number(body.bytes)
  );
  return result.ok
    ? Response.json(result, { status: 201 })
    : Response.json(result, { status: result.error === "asset_too_large" ? 413 : 400 });
}

async function assetContext(params: Params["params"]): Promise<
  | { env: CloudflareEnv; userId: string; projectId: string }
  | Response
> {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  if (!videoWorkspaceAccessFor(user.tier).canUseBrandControls) {
    return Response.json({ error: "upgrade_required" }, { status: 402 });
  }
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
