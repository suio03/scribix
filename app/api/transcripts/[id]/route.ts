import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { R2 } from "@/lib/r2";
import { sanitizeSpeakerNames } from "@/lib/speaker-names";
import {
  deleteVideoWorkspaceObjects,
  hardDeleteVideoProjects,
  videoWorkspaceDeletionForTranscript,
} from "@/lib/video-workspace/lifecycle";

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
    `SELECT user_id, status, audio_r2_key, transcript_r2_key
       FROM transcripts
      WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<{
      user_id: string;
      status: string;
      audio_r2_key: string | null;
      transcript_r2_key: string | null;
    }>();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const workspaceDeletion = await videoWorkspaceDeletionForTranscript(
    env.DB,
    user.id,
    transcriptId
  );

  try {
    await Promise.all([
      deleteVideoWorkspaceObjects(env.SCRIBIX_MEDIA, [
        ...workspaceDeletion.r2Keys,
        ...(row.audio_r2_key ? [row.audio_r2_key] : []),
        ...(row.transcript_r2_key ? [row.transcript_r2_key] : []),
      ]),
      deleteTranslationObjects(env, user.id, transcriptId),
      env.SCRIBIX_MEDIA.delete(R2.summaryKey(user.id, transcriptId)),
    ]);
  } catch (error) {
    console.error(JSON.stringify({
      event: "transcript_r2_delete_failed",
      transcriptId,
      status: row.status,
      errorCategory: "r2_delete",
      error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    }));
    return Response.json({ error: "delete_failed" }, { status: 502 });
  }

  await hardDeleteVideoProjects(env.DB, user.id, workspaceDeletion.projectIds);

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM transcript_translations WHERE transcript_id = ?1`)
      .bind(transcriptId),
    env.DB.prepare(`DELETE FROM transcript_summaries WHERE transcript_id = ?1`)
      .bind(transcriptId),
    env.DB.prepare(`DELETE FROM ai_chat_messages WHERE transcript_id = ?1`)
      .bind(transcriptId),
    env.DB.prepare(
      `UPDATE ai_usage_events
          SET transcript_id = NULL
        WHERE transcript_id = ?1`
    ).bind(transcriptId),
    env.DB.prepare(`UPDATE transcripts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?1`)
      .bind(transcriptId),
  ]);

  return Response.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId } = await params;

  let body: { speakerNames?: unknown; title?: unknown };
  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const hasTitle = Object.hasOwn(body, "title");
  const title = hasTitle ? sanitizeTranscriptTitle(body.title) : null;
  if (hasTitle && !title) {
    return Response.json({ error: "invalid_title" }, { status: 400 });
  }
  const speakerNames = hasTitle ? null : sanitizeSpeakerNames(body.speakerNames);
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const row = await env.DB.prepare(
    `SELECT user_id
       FROM transcripts
      WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<{ user_id: string }>();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (hasTitle) {
    await env.DB.prepare(
      `UPDATE transcripts SET title = ?1 WHERE id = ?2 AND deleted_at IS NULL`
    )
      .bind(title, transcriptId)
      .run();

    return Response.json({ ok: true, title });
  }

  await env.DB.prepare(
    `UPDATE transcripts SET speaker_names_json = ?1 WHERE id = ?2`
  )
    .bind(JSON.stringify(speakerNames), transcriptId)
    .run();

  return Response.json({ ok: true, speakerNames });
}

function sanitizeTranscriptTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.replace(/\s+/g, " ").trim().slice(0, 200);
  return title || null;
}

async function deleteTranslationObjects(
  env: CloudflareEnv,
  userId: string,
  transcriptId: string
): Promise<void> {
  let cursor: string | undefined;
  do {
    const listed = await env.SCRIBIX_MEDIA.list({
      prefix: R2.translationPrefix(userId, transcriptId),
      cursor,
    });
    await Promise.all(listed.objects.map((object) => env.SCRIBIX_MEDIA.delete(object.key)));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}
