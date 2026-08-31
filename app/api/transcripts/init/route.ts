import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { newId, newWebhookToken } from "@/lib/ids";
import { isAllowedMedia, mediaExtension, MULTIPART_PART_BYTES } from "@/lib/media-upload";
import { PLANS } from "@/lib/plans";
import { checkQuota } from "@/lib/quota";
import { createMultipartUpload, presignPut, R2 } from "@/lib/r2";
import {
  createVideoProjectForTranscript,
  deletePendingVideoProjectRecords,
} from "@/lib/video-workspace/projects";
import { videoWorkspaceEnabledForUser } from "@/lib/video-workspace/rollout";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    filename?: string;
    bytes?: number;
    mime?: string;
    durationSec?: number;
    isVideo?: boolean;
    directVideo?: boolean;
    source?: string;
    allowPartial?: boolean;
    workflow?: "transcript" | "video_clips";
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const { filename, bytes, mime } = body;
  if (!filename || typeof bytes !== "number" || !mime) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }
  const isVideo = body.isVideo === true;
  if (body.workflow !== undefined && body.workflow !== "transcript" && body.workflow !== "video_clips") {
    return Response.json({ error: "invalid_workflow" }, { status: 400 });
  }
  const workflow = body.workflow ?? "transcript";
  const directVideo = workflow === "video_clips" || body.directVideo === true;
  const rawDuration = body.durationSec;
  const durationSec = rawDuration == null ? null : Number(rawDuration);
  if (durationSec !== null && (!Number.isFinite(durationSec) || durationSec <= 0)) {
    return Response.json({ error: "invalid_duration" }, { status: 400 });
  }
  if (directVideo && !isVideo) {
    return Response.json({ error: "invalid_direct_video" }, { status: 400 });
  }
  if (!isAllowedMedia(filename, mime, directVideo)) {
    return Response.json({ error: "unsupported_media" }, { status: 415 });
  }
  const source: "upload" | "record" = body.source === "record" ? "record" : "upload";
  if (workflow === "video_clips" && (!isVideo || source !== "upload")) {
    return Response.json({ error: "video_clip_source_required" }, { status: 400 });
  }
  if (source === "record" && durationSec === null) {
    return Response.json({ error: "invalid_duration" }, { status: 400 });
  }

  const env = await cf();
  const userRow = await getOrCreateCurrentUser(env.DB, session);
  if (!userRow) return Response.json({ error: "user_not_found" }, { status: 404 });
  const userId = userRow.id;
  if (workflow === "video_clips" && !videoWorkspaceEnabledForUser(userId, env)) {
    return Response.json({ error: "video_workspace_not_enabled" }, { status: 404 });
  }

  const plan = PLANS[userRow.tier];
  const allowPartial =
    userRow.tier === "free" &&
    source === "upload" &&
    body.allowPartial === true;
  if (
    userRow.tier === "free" &&
    source === "upload" &&
    durationSec === null &&
    !allowPartial
  ) {
    return Response.json(
      { error: "partial_confirmation_required" },
      { status: 409 }
    );
  }

  // Per-file duration cap. Applies to both audio + video.
  if (durationSec !== null && durationSec > plan.maxFileSec) {
    return Response.json(
      { error: "duration_exceeds_tier", maxSec: plan.maxFileSec, tier: userRow.tier },
      { status: 413 }
    );
  }

  // Per-file size cap. Keep audio and browser-side video extraction under the
  // same public 1 GB ceiling.
  const sizeCap = isVideo ? plan.maxVideoUploadBytes : plan.maxFileBytes;
  if (bytes > sizeCap) {
    return Response.json(
      { error: "file_too_large", maxBytes: sizeCap },
      { status: 413 }
    );
  }

  // Pre-flight quota check (read-only). Atomic reserve still happens at /start.
  const estimateMin = durationSec === null ? 1 : Math.ceil(durationSec / 60);
  const quotaCheck = await checkQuota(env.DB, userId, estimateMin, {
    allowPartial,
    requireFullEstimate: userRow.tier === "free" && source === "upload",
  });
  if ("error" in quotaCheck) {
    if (quotaCheck.error === "no_quota") {
      return Response.json(
        {
          error: "no_quota",
          remainingMin: quotaCheck.remainingMin,
          capMin: quotaCheck.capMin,
          tier: userRow.tier,
          canUpgrade: userRow.tier !== "pro",
          suggestedTier: "pro",
        },
        { status: 429 }
      );
    }
    if (quotaCheck.error === "insufficient_quota") {
      return Response.json(
        {
          error: "insufficient_quota",
          remainingMin: quotaCheck.remainingMin,
          capMin: quotaCheck.capMin,
          neededMin: estimateMin,
          tier: userRow.tier,
          canUpgrade: userRow.tier !== "pro",
          suggestedTier: "pro",
        },
        { status: 402 }
      );
    }
    return Response.json({ error: quotaCheck.error }, { status: 400 });
  }

  const transcriptId = newId();
  // Extensionless audio is valid when the browser supplies an audio MIME.
  // Keep a stable, non-executable suffix for its private R2 object key.
  const ext = mediaExtension(filename) ?? "audio";
  const audioKey = R2.audioKey(userId, transcriptId, ext);
  const webhookToken = newWebhookToken();
  const title = filename.replace(/\.[^.]+$/, "").slice(0, 200) || "Untitled";
  const storedMime = mime.toLowerCase();

  await env.DB.prepare(
    `INSERT INTO transcripts
       (id, user_id, title, status, source, audio_r2_key, filename, mime_type,
        bytes, source_duration_sec, speech_model, webhook_token)
     VALUES (?1, ?2, ?3, 'pending', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
  )
    .bind(
      transcriptId,
      userId,
      title,
      source,
      audioKey,
      filename,
      storedMime,
      bytes,
      durationSec,
      plan.speechModels[0],
      webhookToken
    )
    .run();

  let projectId: string | null = null;
  if (workflow === "video_clips") {
    try {
      const project = await createVideoProjectForTranscript(env.DB, userId, transcriptId, userRow.tier, {
        allowPending: true,
      });
      if (project.ok) {
        projectId = project.projectId;
      } else if (project.error === "video_source_storage_limit") {
        await env.DB.prepare(`DELETE FROM transcripts WHERE id = ?1 AND status = 'pending'`)
          .bind(transcriptId)
          .run();
        return Response.json({ error: project.error, ...project.storage }, { status: 413 });
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: "video_project_init_failed",
        transcriptId,
        error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      }));
    }
    if (!projectId) {
      await env.DB.prepare(`DELETE FROM transcripts WHERE id = ?1 AND status = 'pending'`)
        .bind(transcriptId)
        .run();
      return Response.json({ error: "video_project_init_failed" }, { status: 500 });
    }
  }

  if (directVideo) {
    try {
      const uploadId = await createMultipartUpload(audioKey, storedMime);
      return Response.json({
        transcriptId,
        projectId,
        uploadId,
        partSize: MULTIPART_PART_BYTES,
        uploadMode: "multipart",
      });
    } catch (error) {
      if (projectId) await deletePendingVideoProjectRecords(env.DB, projectId, userId);
      await env.DB.prepare(`DELETE FROM transcripts WHERE id = ?1 AND status = 'pending'`)
        .bind(transcriptId)
        .run();
      console.error("multipart init failed", { transcriptId, error });
      return Response.json({ error: "multipart_init_failed" }, { status: 502 });
    }
  }

  const uploadUrl = await presignPut(audioKey, 60 * 60 * 24);
  return Response.json({
    transcriptId,
    uploadUrl,
    uploadMode: "single",
    expiresInSec: 60 * 60 * 24,
  });
}
