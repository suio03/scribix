import { percentile } from "./operations";

type FinalMetricRow = {
  status: string;
  attempt: number;
  queued_at: string | null;
  completed_at: string | null;
};

export async function videoWorkspaceReleaseMetrics(db: D1Database, days: number) {
  const windowDays = Math.max(1, Math.min(90, Math.round(days)));
  const modifier = `-${windowDays} days`;
  const [events, feedback, finalJobs, editEvents, downloads, externalEdits, projects] = await Promise.all([
    db.prepare(
      `SELECT event_name, COUNT(*) AS count
         FROM video_workspace_events
        WHERE created_at >= datetime('now', ?1)
        GROUP BY event_name`
    ).bind(modifier).all<{ event_name: string; count: number }>(),
    db.prepare(
      `SELECT feedback, COUNT(*) AS count
         FROM clip_candidate_feedback_events
        WHERE created_at >= datetime('now', ?1)
        GROUP BY feedback`
    ).bind(modifier).all<{ feedback: "accepted" | "rejected"; count: number }>(),
    db.prepare(
      `SELECT status, attempt, queued_at, completed_at
         FROM render_jobs
        WHERE kind = 'final' AND created_at >= datetime('now', ?1)
        ORDER BY created_at DESC
        LIMIT 1000`
    ).bind(modifier).all<FinalMetricRow>(),
    db.prepare(
      `SELECT properties_json
         FROM video_workspace_events
        WHERE event_name = 'edit_saved' AND created_at >= datetime('now', ?1)
        ORDER BY created_at DESC
        LIMIT 1000`
    ).bind(modifier).all<{ properties_json: string }>(),
    db.prepare(
      `SELECT COUNT(DISTINCT e.render_job_id) AS count
         FROM video_workspace_events e
         JOIN render_jobs j ON j.id = e.render_job_id
        WHERE e.event_name = 'render_downloaded'
          AND j.kind = 'final' AND j.status = 'completed'
          AND j.completed_at >= datetime('now', ?1)`
    ).bind(modifier).first<{ count: number }>(),
    db.prepare(
      `SELECT COUNT(DISTINCT e.render_job_id) AS count
         FROM video_workspace_events e
         JOIN render_jobs j ON j.id = e.render_job_id
        WHERE e.event_name = 'external_edit_required'
          AND j.kind = 'final' AND j.status = 'completed'
          AND j.completed_at >= datetime('now', ?1)`
    ).bind(modifier).first<{ count: number }>(),
    db.prepare(
      `SELECT COUNT(DISTINCT project_id) AS count
         FROM video_workspace_events
        WHERE created_at >= datetime('now', ?1)`
    ).bind(modifier).first<{ count: number }>(),
  ]);
  const feedbackCounts = Object.fromEntries(feedback.results.map((row) => [row.feedback, row.count]));
  const accepted = feedbackCounts.accepted ?? 0;
  const rejected = feedbackCounts.rejected ?? 0;
  const terminal = finalJobs.results.filter((job) => job.status === "completed" || job.status === "failed");
  const completed = terminal.filter((job) => job.status === "completed");
  const totalLatencyMs = completed.flatMap((job) => durationBetween(job.queued_at, job.completed_at));
  const editDurationMs = editEvents.results.flatMap((row) => {
    try {
      const value = JSON.parse(row.properties_json) as { elapsedMs?: unknown };
      return Number.isInteger(value.elapsedMs) ? [Number(value.elapsedMs)] : [];
    } catch {
      return [];
    }
  });
  const downloaded = downloads?.count ?? 0;
  const externalEditCount = externalEdits?.count ?? 0;
  return {
    windowDays,
    projectsEngaged: projects?.count ?? 0,
    events: Object.fromEntries(events.results.map((row) => [row.event_name, row.count])),
    candidates: {
      accepted,
      rejected,
      acceptanceRate: accepted + rejected > 0 ? accepted / (accepted + rejected) : null,
    },
    editing: {
      samples: editDurationMs.length,
      durationMs: {
        p50: percentile(editDurationMs, 0.5),
        p95: percentile(editDurationMs, 0.95),
      },
    },
    renders: {
      requested: finalJobs.results.length,
      completed: completed.length,
      failed: terminal.length - completed.length,
      successRate: terminal.length > 0 ? completed.length / terminal.length : null,
      retryRate: terminal.length > 0
        ? terminal.filter((job) => job.attempt > 1).length / terminal.length
        : null,
      totalLatencyMs: {
        p50: percentile(totalLatencyMs, 0.5),
        p95: percentile(totalLatencyMs, 0.95),
      },
      downloaded,
      downloadRate: completed.length > 0 ? downloaded / completed.length : null,
      externalEditRequired: externalEditCount,
      externalEditRate: downloaded > 0 ? externalEditCount / downloaded : null,
    },
  };
}

function durationBetween(start: string | null, end: string | null): number[] {
  if (!start || !end) return [];
  const startMs = timestamp(start);
  const endMs = timestamp(end);
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
    ? [endMs - startMs]
    : [];
}

function timestamp(value: string): number {
  return Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}
