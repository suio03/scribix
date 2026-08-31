import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { createVideoProjectForTranscript } from "@/lib/video-workspace/projects";
import { videoSourceStorageForUser } from "@/lib/video-workspace/retention";
import { videoWorkspaceEnabledForUser } from "@/lib/video-workspace/rollout";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const { results } = await env.DB.prepare(
    `SELECT p.id, p.transcript_id, p.source_asset_id, p.status,
            p.active_project_version_id, p.created_at, p.updated_at,
            t.title
       FROM video_projects p
       JOIN transcripts t
         ON t.id = p.transcript_id AND t.user_id = p.user_id
      WHERE p.user_id = ?1
        AND p.deleted_at IS NULL
        AND t.deleted_at IS NULL
      ORDER BY p.updated_at DESC`
  )
    .bind(user.id)
    .all();
  const storage = await videoSourceStorageForUser(env.DB, user.id, user.tier);
  return Response.json({ projects: results, sourceStorage: storage });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: { transcriptId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.transcriptId !== "string" || !body.transcriptId) {
    return Response.json({ error: "invalid_transcript_id" }, { status: 400 });
  }

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  if (!videoWorkspaceEnabledForUser(user.id, env)) {
    return Response.json({ error: "video_workspace_not_enabled" }, { status: 404 });
  }
  const result = await createVideoProjectForTranscript(env.DB, user.id, body.transcriptId, user.tier);
  if (!result.ok) {
    const status = result.error === "transcript_not_found"
      ? 404
      : result.error === "transcript_not_ready"
      ? 409
      : result.error === "video_source_storage_limit"
      ? 413
      : 410;
    return Response.json({ error: result.error, ...result.storage }, { status });
  }
  return Response.json(result, { status: result.existing ? 200 : 201 });
}
