// Account deletion. Soft-deletes the user + cascades to their transcripts,
// then removes their R2 objects (audio + transcript JSON).
//
// AssemblyAI-side cleanup is intentionally out of scope here — soft-deleted
// rows retain `aai_transcript_id` so the monthly bulk-delete runbook can
// reach them (see docs/runbooks/aai-bulk-delete.md).

import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { discordAlert } from "@/lib/discord";

export async function DELETE() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const env = cf();

  const { results } = await env.DB.prepare(
    `SELECT audio_r2_key, transcript_r2_key
       FROM transcripts
      WHERE user_id = ?1 AND deleted_at IS NULL`
  )
    .bind(userId)
    .all<{ audio_r2_key: string | null; transcript_r2_key: string | null }>();

  const keys: string[] = [];
  for (const r of results) {
    if (r.audio_r2_key) keys.push(r.audio_r2_key);
    if (r.transcript_r2_key) keys.push(r.transcript_r2_key);
  }

  // R2 first, soft-delete second. If a delete call throws mid-way the rows
  // stay visible to a retry, which can re-select the same keys (R2 delete is
  // idempotent on already-missing keys). Reversing the order would orphan
  // transcript JSON forever, since the next select filters deleted_at IS NULL.
  // R2 binding accepts a string[] of up to 1000 keys per call.
  for (let i = 0; i < keys.length; i += 1000) {
    await env.SCRIBIX_MEDIA.delete(keys.slice(i, i + 1000));
  }

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE transcripts SET deleted_at = CURRENT_TIMESTAMP
        WHERE user_id = ?1 AND deleted_at IS NULL`
    ).bind(userId),
    env.DB.prepare(
      `UPDATE users SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND deleted_at IS NULL`
    ).bind(userId),
  ]);

  await discordAlert("account_deleted", {
    userId,
    email: session.user.email ?? "—",
    transcripts: results.length,
  });

  return Response.json({ ok: true });
}
