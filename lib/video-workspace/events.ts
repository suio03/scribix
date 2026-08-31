export const CLIENT_VIDEO_EVENT_NAMES = [
  "editor_opened",
  "edit_saved",
  "render_downloaded",
  "external_edit_required",
] as const;

export type ClientVideoEventName = (typeof CLIENT_VIDEO_EVENT_NAMES)[number];
export type ServerRenderEventName = "render_requested" | "render_completed" | "render_failed";

type VideoEventInput = {
  eventKey: string;
  userId: string;
  projectId: string;
  candidateId?: string | null;
  renderJobId?: string | null;
  eventName: ClientVideoEventName;
  properties: Record<string, string | number | boolean>;
};

export async function recordVideoWorkspaceEvent(
  db: D1Database,
  input: VideoEventInput
): Promise<boolean> {
  const result = await db.prepare(
    `INSERT OR IGNORE INTO video_workspace_events
       (id, event_key, user_id, project_id, candidate_id, render_job_id,
        event_name, properties_json)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  )
    .bind(
      crypto.randomUUID(),
      input.eventKey,
      input.userId,
      input.projectId,
      input.candidateId ?? null,
      input.renderJobId ?? null,
      input.eventName,
      JSON.stringify(input.properties)
    )
    .run();
  return Boolean(result.meta?.changes);
}

export async function recordServerRenderEvent(
  db: D1Database,
  jobId: string,
  eventName: ServerRenderEventName
): Promise<void> {
  const eventKey = `${eventName}:${jobId}`;
  await db.prepare(
    `INSERT OR IGNORE INTO video_workspace_events
       (id, event_key, user_id, project_id, render_job_id, event_name)
     SELECT ?1, ?2, user_id, project_id, id, ?3
       FROM render_jobs
      WHERE id = ?4 AND kind = 'final'`
  )
    .bind(crypto.randomUUID(), eventKey, eventName, jobId)
    .run();
}

export function validateClientEventProperties(
  eventName: ClientVideoEventName,
  input: unknown
): Record<string, string | number | boolean> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (eventName === "editor_opened") return Object.keys(value).length === 0 ? {} : null;
  if (eventName === "edit_saved") {
    if (!hasOnly(value, ["elapsedMs", "revision", "segmentCount"])) return null;
    if (!integer(value.elapsedMs, 0, 6 * 60 * 60 * 1000)) return null;
    if (!integer(value.revision, 0, 100_000)) return null;
    if (!integer(value.segmentCount, 1, 20)) return null;
    return {
      elapsedMs: value.elapsedMs as number,
      revision: value.revision as number,
      segmentCount: value.segmentCount as number,
    };
  }
  if (eventName === "render_downloaded") {
    return hasOnly(value, ["assetKind"]) && (value.assetKind === "video" || value.assetKind === "cover")
      ? { assetKind: value.assetKind }
      : null;
  }
  if (eventName === "external_edit_required") {
    const reasons = ["captions", "crop", "audio", "branding", "other"];
    return hasOnly(value, ["reason"]) && typeof value.reason === "string" && reasons.includes(value.reason)
      ? { reason: value.reason }
      : null;
  }
  return null;
}

function hasOnly(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => key in value);
}

function integer(value: unknown, min: number, max: number): boolean {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}
