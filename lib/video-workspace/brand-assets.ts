import { newId } from "@/lib/ids";
import { presignPut } from "@/lib/r2";
import { VideoWorkspaceR2 } from "./r2-keys";
import { validBrandAssetHeader } from "./asset-content";

export const BRAND_ASSET_MAX_BYTES = 5 * 1024 * 1024;

const ASSET_FORMATS = {
  logo: {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  },
  font: {
    "font/ttf": "ttf",
    "font/otf": "otf",
    "application/x-font-ttf": "ttf",
    "application/x-font-opentype": "otf",
  },
} as const;

export type BrandAssetKind = keyof typeof ASSET_FORMATS;

export type EditorBrandAsset = {
  id: string;
  kind: BrandAssetKind;
  mimeType: string;
  bytes: number;
  url: string;
};

export async function listBrandAssets(
  db: D1Database,
  userId: string,
  projectId: string,
  signGet: (r2Key: string, expiresInSec: number) => Promise<string>
): Promise<EditorBrandAsset[]> {
  const { results } = await db.prepare(
    `SELECT id, kind, mime_type, bytes, r2_key
       FROM media_assets
      WHERE user_id = ?1
        AND project_id = ?2
        AND kind IN ('logo', 'font')
        AND status = 'ready'
        AND deleted_at IS NULL
        AND r2_key IS NOT NULL
        AND bytes IS NOT NULL
      ORDER BY created_at DESC`
  )
    .bind(userId, projectId)
    .all<{
      id: string;
      kind: BrandAssetKind;
      mime_type: string;
      bytes: number;
      r2_key: string;
    }>();
  return Promise.all(results.map(async (row) => ({
    id: row.id,
    kind: row.kind,
    mimeType: row.mime_type,
    bytes: row.bytes,
    url: await signGet(row.r2_key, 15 * 60),
  })));
}

export async function createBrandAssetUpload(
  db: D1Database,
  userId: string,
  projectId: string,
  kind: BrandAssetKind,
  mimeType: string,
  bytes: number
): Promise<
  | { ok: true; assetId: string; uploadUrl: string; expiresInSec: number }
  | { ok: false; error: "invalid_asset_type" | "asset_too_large" }
> {
  const formats = ASSET_FORMATS[kind] as Record<string, string>;
  const extension = formats[mimeType.toLowerCase()];
  if (!extension) return { ok: false, error: "invalid_asset_type" };
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > BRAND_ASSET_MAX_BYTES) {
    return { ok: false, error: "asset_too_large" };
  }
  const assetId = newId();
  const r2Key = VideoWorkspaceR2.brandAssetKey(userId, assetId, extension);
  await db.prepare(
    `INSERT INTO media_assets
       (id, user_id, project_id, kind, r2_key, mime_type, bytes, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'uploading')`
  )
    .bind(assetId, userId, projectId, kind, r2Key, mimeType.toLowerCase(), bytes)
    .run();
  const expiresInSec = 15 * 60;
  return {
    ok: true,
    assetId,
    uploadUrl: await presignPut(r2Key, expiresInSec),
    expiresInSec,
  };
}

export async function completeBrandAssetUpload(
  db: D1Database,
  bucket: R2Bucket,
  userId: string,
  projectId: string,
  assetId: string
): Promise<
  | { ok: true }
  | { ok: false; error: "asset_not_found" | "asset_missing" | "asset_size_mismatch" | "invalid_asset_content" }
> {
  const asset = await db.prepare(
    `SELECT id, kind, r2_key, mime_type, bytes
       FROM media_assets
      WHERE id = ?1
        AND user_id = ?2
        AND project_id = ?3
        AND kind IN ('logo', 'font')
        AND status = 'uploading'
        AND deleted_at IS NULL`
  )
    .bind(assetId, userId, projectId)
    .first<{
      id: string;
      kind: BrandAssetKind;
      r2_key: string;
      mime_type: string;
      bytes: number;
    }>();
  if (!asset) return { ok: false, error: "asset_not_found" };
  const object = await bucket.head(asset.r2_key);
  if (!object) return { ok: false, error: "asset_missing" };
  if (object.size !== asset.bytes || object.size > BRAND_ASSET_MAX_BYTES) {
    return { ok: false, error: "asset_size_mismatch" };
  }
  const headerObject = await bucket.get(asset.r2_key, { range: { offset: 0, length: 16 } });
  const header = headerObject
    ? new Uint8Array(await headerObject.arrayBuffer())
    : new Uint8Array();
  if (!validBrandAssetHeader(asset.kind, asset.mime_type, header)) {
    await bucket.delete(asset.r2_key);
    await db.prepare(
      `UPDATE media_assets
          SET status = 'failed', r2_key = NULL
        WHERE id = ?1 AND user_id = ?2 AND status = 'uploading'`
    )
      .bind(assetId, userId)
      .run();
    return { ok: false, error: "invalid_asset_content" };
  }
  await db.prepare(
    `UPDATE media_assets
        SET status = 'ready', bytes = ?1
      WHERE id = ?2
        AND user_id = ?3
        AND project_id = ?4
        AND status = 'uploading'`
  )
    .bind(object.size, assetId, userId, projectId)
    .run();
  return { ok: true };
}
