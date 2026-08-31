import { auth } from "@/auth";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import {
  CLIENT_VIDEO_EVENT_NAMES,
  recordVideoWorkspaceEvent,
  validateClientEventProperties,
  type ClientVideoEventName,
} from "@/lib/video-workspace/events";

type Params = { params: Promise<{ id: string }> };
const EVENT_KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,159}$/;
const ENTITY_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  let body: {
    eventName?: unknown;
    eventKey?: unknown;
    candidateId?: unknown;
    renderJobId?: unknown;
    properties?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    typeof body.eventName !== "string" ||
    !(CLIENT_VIDEO_EVENT_NAMES as readonly string[]).includes(body.eventName) ||
    typeof body.eventKey !== "string" ||
    !EVENT_KEY.test(body.eventKey)
  ) {
    return Response.json({ error: "invalid_event" }, { status: 400 });
  }
  const eventName = body.eventName as ClientVideoEventName;
  const properties = validateClientEventProperties(eventName, body.properties);
  if (!properties) return Response.json({ error: "invalid_event_properties" }, { status: 400 });

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });
  const project = await env.DB.prepare(
    `SELECT id FROM video_projects
      WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
  )
    .bind(projectId, user.id)
    .first<{ id: string }>();
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });

  const editorEvent = eventName === "editor_opened" || eventName === "edit_saved";
  const candidateId = editorEvent && typeof body.candidateId === "string" && ENTITY_ID.test(body.candidateId)
    ? body.candidateId
    : null;
  const renderJobId = !editorEvent && typeof body.renderJobId === "string" && ENTITY_ID.test(body.renderJobId)
    ? body.renderJobId
    : null;
  if (editorEvent) {
    if (!candidateId || !(await ownedCandidate(env.DB, user.id, projectId, candidateId))) {
      return Response.json({ error: "candidate_not_found" }, { status: 404 });
    }
  }
  if (eventName === "render_downloaded" || eventName === "external_edit_required") {
    if (!renderJobId || !(await ownedCompletedRender(env.DB, user.id, projectId, renderJobId))) {
      return Response.json({ error: "render_not_found" }, { status: 404 });
    }
  }
  const recorded = await recordVideoWorkspaceEvent(env.DB, {
    eventKey: body.eventKey,
    userId: user.id,
    projectId,
    candidateId,
    renderJobId,
    eventName,
    properties,
  });
  return Response.json({ ok: true, recorded });
}

async function ownedCandidate(
  db: D1Database,
  userId: string,
  projectId: string,
  candidateId: string
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT id FROM clip_candidates
      WHERE id = ?1 AND project_id = ?2 AND user_id = ?3 AND status <> 'deleted'`
  )
    .bind(candidateId, projectId, userId)
    .first<{ id: string }>();
  return Boolean(row);
}

async function ownedCompletedRender(
  db: D1Database,
  userId: string,
  projectId: string,
  jobId: string
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT id FROM render_jobs
      WHERE id = ?1 AND project_id = ?2 AND user_id = ?3
        AND kind = 'final' AND status = 'completed'`
  )
    .bind(jobId, projectId, userId)
    .first<{ id: string }>();
  return Boolean(row);
}
