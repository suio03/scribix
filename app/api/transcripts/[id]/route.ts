import { auth } from "@/auth";
import { cf } from "@/lib/cf";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId } = await params;

  const env = cf();
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
  if (row.user_id !== session.user.id) {
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
