import { PLANS, type Tier } from "@/lib/plans";

const DAY_MS = 24 * 60 * 60 * 1000;

export const FINAL_EXPORT_RETENTION_DAYS = 30;

export type VideoSourceStorage = {
  usedBytes: number;
  limitBytes: number;
  availableBytes: number;
  retentionDays: number;
};

export function videoSourceExpiresAt(tier: Tier, now = new Date()): string {
  return new Date(now.getTime() + PLANS[tier].videoSourceRetentionDays * DAY_MS)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

export function finalExportExpiresAt(now = new Date()): string {
  return new Date(now.getTime() + FINAL_EXPORT_RETENTION_DAYS * DAY_MS)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

export async function videoSourceStorageForUser(
  db: D1Database,
  userId: string,
  tier: Tier
): Promise<VideoSourceStorage> {
  const row = await db.prepare(
    `SELECT COALESCE(SUM(bytes), 0) AS used_bytes
       FROM media_assets
      WHERE user_id = ?1
        AND kind = 'source'
        AND deleted_at IS NULL
        AND status IN ('pending', 'uploading', 'ready')`
  )
    .bind(userId)
    .first<{ used_bytes: number }>();
  const usedBytes = Number(row?.used_bytes ?? 0);
  const limitBytes = PLANS[tier].maxVideoSourceStorageBytes;
  return {
    usedBytes,
    limitBytes,
    availableBytes: Math.max(0, limitBytes - usedBytes),
    retentionDays: PLANS[tier].videoSourceRetentionDays,
  };
}
