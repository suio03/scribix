import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { presignGet } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

const AUDIO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId } = await params;

  const env = cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const row = await env.DB.prepare(
    `SELECT user_id, audio_r2_key, created_at
       FROM transcripts
      WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<{
      user_id: string;
      audio_r2_key: string | null;
      created_at: string;
    }>();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (!row.audio_r2_key) {
    return Response.json({ error: "audio_missing" }, { status: 410 });
  }
  const ts = new Date(
    row.created_at.includes("T") ? row.created_at : row.created_at.replace(" ", "T") + "Z"
  ).getTime();
  if (!Number.isNaN(ts) && Date.now() - ts > AUDIO_TTL_MS) {
    return Response.json({ error: "audio_expired" }, { status: 410 });
  }

  const url = await presignGet(row.audio_r2_key, 60 * 5);
  return Response.redirect(url, 302);
}
