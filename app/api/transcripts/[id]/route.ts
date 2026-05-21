import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId } = await params;

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const row = await env.DB.prepare(
    `SELECT id, user_id, status, transcript_r2_key
       FROM transcripts
      WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<{
      id: string;
      user_id: string;
      status: string;
      transcript_r2_key: string | null;
    }>();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (row.status !== "completed" || !row.transcript_r2_key) {
    return Response.json({ error: "not_ready", status: row.status }, { status: 409 });
  }

  const obj = await env.SCRIBIX_MEDIA.get(row.transcript_r2_key);
  if (!obj) return Response.json({ error: "transcript_missing" }, { status: 410 });

  return new Response(obj.body, {
    headers: { "content-type": "application/json" },
  });
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId } = await params;

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const row = await env.DB.prepare(
    `SELECT user_id, audio_r2_key, transcript_r2_key
       FROM transcripts
      WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<{
      user_id: string;
      audio_r2_key: string | null;
      transcript_r2_key: string | null;
    }>();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await env.DB.prepare(
    `UPDATE transcripts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?1`
  )
    .bind(transcriptId)
    .run();

  // Best-effort R2 cleanup. Soft-delete row stays as the source of truth;
  // any failure here is swallowed since the user already sees the row gone.
  await Promise.all([
    row.audio_r2_key ? env.SCRIBIX_MEDIA.delete(row.audio_r2_key).catch(() => {}) : null,
    row.transcript_r2_key
      ? env.SCRIBIX_MEDIA.delete(row.transcript_r2_key).catch(() => {})
      : null,
  ]);

  return Response.json({ ok: true });
}
