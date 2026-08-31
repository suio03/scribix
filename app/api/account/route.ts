// Account deletion. Soft-deletes the user + cascades to their transcripts,
// then removes their R2 objects (audio + transcript JSON).
//
// AssemblyAI-side cleanup is intentionally out of scope here — soft-deleted
// rows retain `aai_transcript_id` so the monthly bulk-delete runbook can
// reach them (see docs/runbooks/aai-bulk-delete.md).

import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import {
  accountVideoWorkspaceDeleteStatements,
  deleteVideoWorkspaceObjects,
} from "@/lib/video-workspace/lifecycle";

export async function DELETE() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const userId = user.id;

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
  const workspaceAssets = await env.DB.prepare(
    `SELECT r2_key FROM media_assets WHERE user_id = ?1 AND r2_key IS NOT NULL`
  )
    .bind(userId)
    .all<{ r2_key: string }>();
  keys.push(...workspaceAssets.results.map((asset) => asset.r2_key));

  // R2 first, soft-delete second. If a delete call throws mid-way the rows
  // stay visible to a retry, which can re-select the same keys (R2 delete is
  // idempotent on already-missing keys). Reversing the order would orphan
  // transcript JSON forever, since the next select filters deleted_at IS NULL.
  // R2 binding accepts a string[] of up to 1000 keys per call.
  await deleteVideoWorkspaceObjects(env.SCRIBIX_MEDIA, keys);

  await env.DB.batch([
    ...accountVideoWorkspaceDeleteStatements(env.DB, userId),
    env.DB.prepare(
      `DELETE FROM ai_chat_messages WHERE user_id = ?1`
    ).bind(userId),
    env.DB.prepare(
      `UPDATE ai_usage_events
          SET user_id = NULL,
              transcript_id = NULL
        WHERE user_id = ?1`
    ).bind(userId),
    env.DB.prepare(
      `UPDATE transcripts SET deleted_at = CURRENT_TIMESTAMP
        WHERE user_id = ?1 AND deleted_at IS NULL`
    ).bind(userId),
    env.DB.prepare(
      `UPDATE users SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = ?1 AND deleted_at IS NULL`
    ).bind(userId),
  ]);

  console.info(
    JSON.stringify({
      event: "account_deleted",
      userId,
      transcripts: results.length,
    })
  );

  return Response.json({ ok: true });
}
