import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import {
  completeBrandAssetUpload,
  deleteBrandAsset,
} from "@/lib/video-workspace/brand-assets";

type Params = { params: Promise<{ id: string; assetId: string }> };

export async function POST(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id, assetId } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const result = await completeBrandAssetUpload(
    env.DB,
    env.SCRIBIX_MEDIA,
    user.id,
    id,
    assetId
  );
  if (!result.ok) {
    return Response.json(result, {
      status: result.error === "asset_not_found" ? 404 : result.error === "asset_missing" ? 409 : 422,
    });
  }
  return Response.json(result);
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id, assetId } = await params;
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const result = await deleteBrandAsset(
    env.DB,
    env.SCRIBIX_MEDIA,
    user.id,
    id,
    assetId
  );
  return result.ok
    ? Response.json(result)
    : Response.json(result, { status: 404 });
}
