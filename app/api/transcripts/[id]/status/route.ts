import { auth } from "@/auth";
import { getTranscript } from "@/lib/aai";
import { cf } from "@/lib/cf";
import { discordAlert } from "@/lib/discord";
import { reconcileQuota } from "@/lib/quota";
import { applyAaiResult } from "@/app/api/webhook/assemblyai/route";

type Params = { params: Promise<{ id: string }> };

const STALE_AFTER_MIN = 15;
const STRANDED_UPLOAD_MIN = 30;

export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: transcriptId } = await params;

  const env = cf();
  const row = await env.DB.prepare(
    `SELECT id, user_id, webhook_token, reserved_minutes, status, error,
            aai_transcript_id, created_at, completed_at
       FROM transcripts
      WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(transcriptId)
    .first<{
      id: string;
      user_id: string;
      webhook_token: string;
      reserved_minutes: number | null;
      status: string;
      error: string | null;
      aai_transcript_id: string | null;
      created_at: string;
      completed_at: string | null;
    }>();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== session.user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  // Stranded-upload recovery: AAI accepted the job but the post-submit DB
  // write never landed (worker died / D1 transient failure). Without this the
  // row sits at 'uploading' forever, holding reserved quota. After 30 min we
  // claim the row atomically — only the winner refunds, so concurrent pollers
  // can't double-credit the user's minutes.
  if (
    row.status === "uploading" &&
    !row.aai_transcript_id &&
    isOlderThanMin(row.created_at, STRANDED_UPLOAD_MIN)
  ) {
    const claim = await env.DB.prepare(
      `UPDATE transcripts SET status = 'error', error = ?1, reserved_minutes = 0
        WHERE id = ?2 AND status = 'uploading' AND aai_transcript_id IS NULL`
    )
      .bind("upload_stranded", transcriptId)
      .run();
    if (claim.meta?.changes) {
      if (row.reserved_minutes && row.reserved_minutes > 0) {
        await reconcileQuota(env.DB, row.user_id, row.reserved_minutes, 0);
      }
      await discordAlert("transcription_failed", {
        stage: "stranded_upload_recovery",
        transcriptId,
        userId: row.user_id,
        reservedMin: row.reserved_minutes,
      });
    }
    return Response.json(await readStatus(env, transcriptId));
  }

  // §9.3 inline reconcile. Only fire when the user is actually waiting
  // and the row has been pending long enough that a webhook should have landed.
  if (
    row.aai_transcript_id &&
    (row.status === "queued" || row.status === "processing") &&
    isStale(row.created_at)
  ) {
    try {
      const aai = await getTranscript(row.aai_transcript_id);
      if (aai.status === "completed" || aai.status === "error") {
        await applyAaiResult(env, row, aai);
        return Response.json(await readStatus(env, transcriptId));
      }
      // AAI still processing — bubble its status up so the UI can be precise.
      if (aai.status === "processing" && row.status !== "processing") {
        await env.DB.prepare(
          `UPDATE transcripts SET status = 'processing'
            WHERE id = ?1 AND status NOT IN ('completed', 'error')`
        )
          .bind(transcriptId)
          .run();
      }
    } catch {
      // Swallow — next poll will retry. The user-facing status stays whatever the row says.
    }
  }

  return Response.json(await readStatus(env, transcriptId));
}

function isStale(createdAt: string): boolean {
  return isOlderThanMin(createdAt, STALE_AFTER_MIN);
}

function isOlderThanMin(createdAt: string, min: number): boolean {
  const created = new Date(createdAt.replace(" ", "T") + "Z").getTime();
  return Date.now() - created > min * 60 * 1000;
}

async function readStatus(env: CloudflareEnv, id: string) {
  const r = await env.DB.prepare(
    `SELECT status, error, completed_at FROM transcripts WHERE id = ?1`
  )
    .bind(id)
    .first<{ status: string; error: string | null; completed_at: string | null }>();
  return {
    status: r?.status ?? "unknown",
    error: r?.error ?? null,
    completedAt: r?.completed_at ?? null,
  };
}
