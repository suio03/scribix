import { presignGet, presignPut } from "@/lib/r2";
import { ownedProjectAsset } from "./ownership";

export type AssetAccessResult =
  | { ok: true; url: string; expiresInSec: number }
  | { ok: false; error: "asset_not_found" | "asset_not_ready" | "asset_key_missing" };

export async function presignOwnedAssetGet(
  db: D1Database,
  userId: string,
  projectId: string,
  assetId: string,
  expiresInSec = 5 * 60
): Promise<AssetAccessResult> {
  const asset = await ownedProjectAsset(db, assetId, projectId, userId);
  if (!asset) return { ok: false, error: "asset_not_found" };
  if (asset.status !== "ready") return { ok: false, error: "asset_not_ready" };
  if (!asset.r2_key) return { ok: false, error: "asset_key_missing" };
  return {
    ok: true,
    url: await presignGet(asset.r2_key, expiresInSec),
    expiresInSec,
  };
}

export async function presignOwnedAssetPut(
  db: D1Database,
  userId: string,
  projectId: string,
  assetId: string,
  expiresInSec = 15 * 60
): Promise<AssetAccessResult> {
  const asset = await ownedProjectAsset(db, assetId, projectId, userId);
  if (!asset) return { ok: false, error: "asset_not_found" };
  if (asset.status !== "pending" && asset.status !== "uploading") {
    return { ok: false, error: "asset_not_ready" };
  }
  if (!asset.r2_key) return { ok: false, error: "asset_key_missing" };
  return {
    ok: true,
    url: await presignPut(asset.r2_key, expiresInSec),
    expiresInSec,
  };
}
