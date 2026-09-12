-- Operational selection lease. No user requirement text is written to analytics.
ALTER TABLE video_projects ADD COLUMN selection_json TEXT;
ALTER TABLE video_projects ADD COLUMN selection_request_id TEXT;
ALTER TABLE video_projects ADD COLUMN selection_outcome TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE video_projects ADD COLUMN selection_adjustments INTEGER NOT NULL DEFAULT 1 CHECK (selection_adjustments IN (0, 1));
UPDATE video_projects SET selection_outcome = 'matched' WHERE EXISTS (
  SELECT 1 FROM clip_candidates c WHERE c.project_id = video_projects.id AND c.origin = 'ai'
);
UPDATE video_projects SET selection_outcome = 'empty' WHERE status = 'candidates_ready' AND selection_outcome = 'idle';

ALTER TABLE clip_candidates ADD COLUMN publish_draft_json TEXT;
ALTER TABLE project_versions ADD COLUMN publish_draft_json TEXT;
-- Bounded operational quota/lease, one row per user, not event tracking.
CREATE TABLE publish_generation_limits (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  execution_id TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  request_times_json TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE publish_packages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
  render_job_id TEXT NOT NULL REFERENCES render_jobs(id) ON DELETE CASCADE,
  publish_draft_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_publish_packages_job ON publish_packages(render_job_id, user_id);
