import { VIDEO_WORKSPACE_SCHEMA_VERSION, type RenderDispatchMessage } from "./contracts";

export const PRODUCTION_RENDER_CONCURRENCY = 10;
export type ClaimedRenderJob = {
  id: string;
  user_id: string;
  kind: "preview" | "final";
  status: string;
  provider_job_id: string | null;
  attempt: number;
};

export function renderConcurrency(configured?: string): number {
  const value = Number(configured ?? PRODUCTION_RENDER_CONCURRENCY);
  return Number.isInteger(value) && value > 0
    ? Math.min(value, PRODUCTION_RENDER_CONCURRENCY)
    : PRODUCTION_RENDER_CONCURRENCY;
}

// A single SQLite write chooses AND reserves capacity. Separate reads and writes
// would race when a queue batch and a recovery wake run at the same time.
export async function claimNextRenderJob(db: D1Database, limit: number): Promise<ClaimedRenderJob | null> {
  return db.prepare(`
    UPDATE render_jobs
       SET status = 'preparing', provider = 'cloudflare-containers',
           attempt = attempt + 1, error_code = NULL,
           provider_submitted_at = strftime('%Y-%m-%d %H:%M:%f', 'now'),
           updated_at = CURRENT_TIMESTAMP
     WHERE id = (
       SELECT waiting.id FROM render_jobs waiting
       JOIN video_projects project ON project.id = waiting.project_id
       WHERE waiting.status = 'queued' AND waiting.provider_job_id IS NULL
         AND project.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM render_jobs active
           WHERE active.user_id = waiting.user_id
             AND active.status IN ('preparing', 'running', 'uploading')
         )
       ORDER BY COALESCE((
         SELECT MAX(history.provider_submitted_at) FROM render_jobs history
         WHERE history.user_id = waiting.user_id
       ), '') ASC, waiting.created_at ASC, waiting.id ASC
       LIMIT 1
     )
       AND (SELECT COUNT(*) FROM render_jobs
            WHERE status IN ('preparing', 'running', 'uploading')) < ?1
     RETURNING id, user_id, kind, status, provider_job_id, attempt
  `).bind(limit).first<ClaimedRenderJob>();
}

// The message is a wake-up hint; the database remains the durable queue.
export async function wakeRenderScheduler(
  db: D1Database,
  queue: Queue<RenderDispatchMessage>,
  delaySeconds = 0
): Promise<void> {
  const job = await db.prepare(`SELECT id FROM render_jobs
    WHERE status = 'queued' AND provider_job_id IS NULL
    ORDER BY created_at, id LIMIT 1`).first<{ id: string }>();
  if (job) await queue.send({ schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION, jobId: job.id }, { delaySeconds });
}

// Authenticated workspace polling also recovers local messages lost on restart.
// Touch at most one job per project every 15s; never resubmit a running container.
export async function recoverProjectRenderQueue(
  db: D1Database,
  queue: Queue<RenderDispatchMessage>,
  userId: string,
  projectId: string
): Promise<void> {
  const job = await db.prepare(`UPDATE render_jobs SET updated_at = CURRENT_TIMESTAMP
    WHERE id = (
      SELECT id FROM render_jobs WHERE user_id = ?1 AND project_id = ?2
        AND status = 'queued' AND provider_job_id IS NULL
        AND updated_at < datetime('now', '-15 seconds')
        AND NOT EXISTS (SELECT 1 FROM render_jobs recent
          WHERE recent.user_id = ?1 AND recent.project_id = ?2
            AND recent.status = 'queued' AND recent.updated_at >= datetime('now', '-15 seconds'))
      ORDER BY created_at, id LIMIT 1
    ) RETURNING id`).bind(userId, projectId).first<{ id: string }>();
  if (job) await queue.send({ schemaVersion: VIDEO_WORKSPACE_SCHEMA_VERSION, jobId: job.id });
}
