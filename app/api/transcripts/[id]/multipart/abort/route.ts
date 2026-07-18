import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { abortMultipartUpload } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  let body: { uploadId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.uploadId) return Response.json({ error: "missing_upload_id" }, { status: 400 });

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const row = await env.DB.prepare(
    `SELECT user_id, audio_r2_key FROM transcripts WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(id)
    .first<{ user_id: string; audio_r2_key: string | null }>();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== user.id) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!row.audio_r2_key) return Response.json({ ok: true });

  try {
    await abortMultipartUpload(row.audio_r2_key, body.uploadId);
  } catch (error) {
    console.error("multipart abort failed", { transcriptId: id, error });
    return Response.json({ error: "multipart_abort_failed" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
