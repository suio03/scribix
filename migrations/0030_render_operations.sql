-- Operational timing and cost attribution for preview/final render jobs.

ALTER TABLE render_jobs ADD COLUMN provider_submitted_at DATETIME;
ALTER TABLE render_jobs ADD COLUMN upload_started_at DATETIME;
ALTER TABLE render_jobs ADD COLUMN billable_duration_ms INTEGER
  CHECK (billable_duration_ms IS NULL OR billable_duration_ms >= 0);
ALTER TABLE render_jobs ADD COLUMN estimated_cost_microusd INTEGER
  CHECK (estimated_cost_microusd IS NULL OR estimated_cost_microusd >= 0);
ALTER TABLE render_jobs ADD COLUMN cost_model TEXT;

CREATE INDEX idx_render_jobs_metrics
  ON render_jobs(kind, status, completed_at)
  WHERE completed_at IS NOT NULL;

CREATE INDEX idx_render_jobs_cost_pending
  ON render_jobs(completed_at)
  WHERE provider_submitted_at IS NOT NULL
    AND completed_at IS NOT NULL
    AND estimated_cost_microusd IS NULL;

-- Defense in depth for concurrent API requests. Application preflight returns
-- friendly errors; these triggers close the read-then-insert/update race.
CREATE TRIGGER render_jobs_final_insert_limits
BEFORE INSERT ON render_jobs
WHEN NEW.kind = 'final' AND NEW.status = 'queued'
BEGIN
  SELECT RAISE(ABORT, 'render_concurrency_limit')
   WHERE (
     SELECT COUNT(*) FROM render_jobs
      WHERE user_id = NEW.user_id
        AND kind = 'final'
        AND status IN ('queued', 'preparing', 'running', 'uploading')
   ) >= 2;
  SELECT RAISE(ABORT, 'render_daily_limit')
   WHERE (
     SELECT COUNT(*) FROM render_jobs
      WHERE user_id = NEW.user_id
        AND kind = 'final'
        AND created_at >= datetime('now', '-1 day')
   ) >= 20;
END;

CREATE TRIGGER render_jobs_final_retry_limit
BEFORE UPDATE OF status ON render_jobs
WHEN NEW.kind = 'final'
  AND NEW.status = 'queued'
  AND OLD.status IN ('failed', 'canceled')
BEGIN
  SELECT RAISE(ABORT, 'render_concurrency_limit')
   WHERE (
     SELECT COUNT(*) FROM render_jobs
      WHERE user_id = NEW.user_id
        AND kind = 'final'
        AND id <> NEW.id
        AND status IN ('queued', 'preparing', 'running', 'uploading')
   ) >= 2;
END;
