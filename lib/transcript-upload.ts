import { isUploadExpired } from "@/lib/media-upload";

export type PendingUploadRow = {
  id: string;
  user_id: string;
  status: string;
  audio_r2_key: string | null;
  mime_type: string | null;
  bytes: number | null;
  created_at: string;
};

export async function pendingUploadForUser(
  db: D1Database,
  transcriptId: string,
  userId: string
): Promise<{ row?: PendingUploadRow; response?: Response }> {
  const row = await db.prepare(
    `SELECT id, user_id, status, audio_r2_key, mime_type, bytes, created_at
       FROM transcripts
      WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<PendingUploadRow>();
  if (!row) return { response: Response.json({ error: "not_found" }, { status: 404 }) };
  if (row.user_id !== userId) {
    return { response: Response.json({ error: "forbidden" }, { status: 403 }) };
  }
  if (isUploadExpired(row.created_at)) {
    return { response: Response.json({ error: "upload_expired" }, { status: 410 }) };
  }
  if (row.status !== "pending") {
    return {
      response: Response.json({ error: "already_started", status: row.status }, { status: 409 }),
    };
  }
  if (!row.audio_r2_key || !row.mime_type?.startsWith("video/") || !row.bytes) {
    return { response: Response.json({ error: "not_multipart_video" }, { status: 400 }) };
  }
  return { row };
}
