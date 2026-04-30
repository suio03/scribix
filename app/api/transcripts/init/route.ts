import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { newId, newWebhookToken } from "@/lib/ids";
import { PLANS, type Tier } from "@/lib/plans";
import { presignPut, R2 } from "@/lib/r2";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  let body: { filename?: string; bytes?: number; mime?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const { filename, bytes, mime } = body;
  if (!filename || typeof bytes !== "number" || !mime) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }
  const source: "upload" | "record" = body.source === "record" ? "record" : "upload";

  const env = cf();
  const userRow = await env.DB.prepare(
    `SELECT tier FROM users WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(userId)
    .first<{ tier: Tier }>();
  if (!userRow) return Response.json({ error: "user_not_found" }, { status: 404 });

  const plan = PLANS[userRow.tier];
  if (bytes > plan.maxFileBytes) {
    return Response.json(
      { error: "file_too_large", maxBytes: plan.maxFileBytes },
      { status: 413 }
    );
  }

  const transcriptId = newId();
  const ext = (filename.split(".").pop() ?? "bin").toLowerCase().slice(0, 8);
  const audioKey = R2.audioKey(userId, transcriptId, ext);
  const webhookToken = newWebhookToken();
  const title = filename.replace(/\.[^.]+$/, "").slice(0, 200) || "Untitled";

  await env.DB.prepare(
    `INSERT INTO transcripts
       (id, user_id, title, status, source, audio_r2_key, filename, mime_type, bytes, speech_model, webhook_token)
     VALUES (?1, ?2, ?3, 'pending', ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
  )
    .bind(
      transcriptId,
      userId,
      title,
      source,
      audioKey,
      filename,
      mime,
      bytes,
      plan.speechModels[0],
      webhookToken
    )
    .run();

  const uploadUrl = await presignPut(audioKey, 60 * 60 * 24);
  return Response.json({ transcriptId, uploadUrl, expiresInSec: 60 * 60 * 24 });
}
