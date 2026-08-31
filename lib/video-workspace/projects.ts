import { newId } from "@/lib/ids";
import { PLANS, type Tier } from "@/lib/plans";
import { videoSourceExpiresAt, videoSourceStorageForUser } from "./retention";

type TranscriptSourceRow = {
  id: string;
  status: string;
  audio_r2_key: string | null;
  mime_type: string | null;
  bytes: number | null;
  duration_sec: number | null;
  source_duration_sec: number | null;
};

export type CreateVideoProjectResult =
  | { ok: true; projectId: string; sourceAssetId: string; existing: boolean }
  | {
      ok: false;
      error:
        | "transcript_not_found"
        | "transcript_not_ready"
        | "source_video_required"
        | "video_source_storage_limit";
      storage?: {
        usedBytes: number;
        limitBytes: number;
        requiredBytes: number;
        retentionDays: number;
      };
    };

export async function createVideoProjectForTranscript(
  db: D1Database,
  userId: string,
  transcriptId: string,
  tier: Tier,
  options: { allowPending?: boolean; now?: Date } = {}
): Promise<CreateVideoProjectResult> {
  const transcript = await db.prepare(
    `SELECT id, status, audio_r2_key, mime_type, bytes, duration_sec, source_duration_sec
       FROM transcripts
      WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
  )
    .bind(transcriptId, userId)
    .first<TranscriptSourceRow>();
  if (!transcript) return { ok: false, error: "transcript_not_found" };
  if (!options.allowPending && transcript.status !== "completed") {
    return { ok: false, error: "transcript_not_ready" };
  }
  if (
    !transcript.audio_r2_key ||
    !transcript.mime_type?.startsWith("video/") ||
    !transcript.bytes
  ) {
    return { ok: false, error: "source_video_required" };
  }

  const existing = await existingVideoProject(db, userId, transcriptId);
  if (existing) return { ok: true, ...existing, existing: true };

  const projectId = newId();
  const sourceAssetId = newId();
  const durationSec = transcript.source_duration_sec ?? transcript.duration_sec;
  const sourceAssetStatus = options.allowPending ? "uploading" : "ready";
  const limitBytes = PLANS[tier].maxVideoSourceStorageBytes;
  const expiresAt = videoSourceExpiresAt(tier, options.now);
  try {
    const results = await db.batch([
      db.prepare(
        `INSERT INTO video_projects (id, user_id, transcript_id, status)
         VALUES (?1, ?2, ?3, 'draft')`
      ).bind(projectId, userId, transcriptId),
      db.prepare(
        `INSERT INTO media_assets
           (id, user_id, project_id, kind, r2_key, mime_type, bytes,
            duration_ms, status, expires_at)
         SELECT ?1, ?2, ?3, 'source', ?4, ?5, ?6, ?7, ?8, ?9
          WHERE (
            SELECT COALESCE(SUM(bytes), 0)
              FROM media_assets
             WHERE user_id = ?2
               AND kind = 'source'
               AND deleted_at IS NULL
               AND status IN ('pending', 'uploading', 'ready')
          ) + ?6 <= ?10`
      ).bind(
        sourceAssetId,
        userId,
        projectId,
        transcript.audio_r2_key,
        transcript.mime_type,
        transcript.bytes,
        durationSec === null ? null : Math.round(durationSec * 1000),
        sourceAssetStatus,
        expiresAt,
        limitBytes
      ),
      db.prepare(
        `UPDATE video_projects
            SET source_asset_id = ?1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?2 AND user_id = ?3
            AND EXISTS (
              SELECT 1 FROM media_assets
               WHERE id = ?1 AND user_id = ?3 AND project_id = ?2
            )`
      ).bind(sourceAssetId, projectId, userId),
    ]);
    if (!results[1].meta?.changes) {
      await db.prepare(`DELETE FROM video_projects WHERE id = ?1 AND user_id = ?2`)
        .bind(projectId, userId)
        .run();
      const storage = await videoSourceStorageForUser(db, userId, tier);
      return {
        ok: false,
        error: "video_source_storage_limit",
        storage: {
          usedBytes: storage.usedBytes,
          limitBytes: storage.limitBytes,
          requiredBytes: transcript.bytes,
          retentionDays: storage.retentionDays,
        },
      };
    }
  } catch (error) {
    const raced = await existingVideoProject(db, userId, transcriptId);
    if (raced) return { ok: true, ...raced, existing: true };
    throw error;
  }
  return { ok: true, projectId, sourceAssetId, existing: false };
}

async function existingVideoProject(
  db: D1Database,
  userId: string,
  transcriptId: string
): Promise<{ projectId: string; sourceAssetId: string } | null> {
  const row = await db.prepare(
    `SELECT id, source_asset_id
       FROM video_projects
      WHERE transcript_id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
  )
    .bind(transcriptId, userId)
    .first<{ id: string; source_asset_id: string | null }>();
  return row?.source_asset_id
    ? { projectId: row.id, sourceAssetId: row.source_asset_id }
    : null;
}

export async function deletePendingVideoProjectRecords(
  db: D1Database,
  projectId: string,
  userId: string
): Promise<void> {
  await db.batch([
    db.prepare(
      `UPDATE video_projects
          SET source_asset_id = NULL
        WHERE id = ?1 AND user_id = ?2 AND status = 'draft'`
    ).bind(projectId, userId),
    db.prepare(
      `DELETE FROM media_assets
        WHERE project_id = ?1 AND user_id = ?2 AND status = 'uploading'`
    ).bind(projectId, userId),
    db.prepare(
      `DELETE FROM video_projects
        WHERE id = ?1 AND user_id = ?2 AND status = 'draft'`
    ).bind(projectId, userId),
  ]);
}
