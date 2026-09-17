CREATE TABLE ai_analysis_tasks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id), user_id TEXT NOT NULL,
  request_id TEXT NOT NULL, transcript_id TEXT NOT NULL, requirements_json TEXT NOT NULL,
  range_json TEXT NOT NULL, previous_selection_json TEXT NOT NULL, algorithm_version TEXT NOT NULL, transcript_digest TEXT,
  input_key TEXT, purged_at TEXT, status TEXT NOT NULL DEFAULT 'waiting', phase TEXT NOT NULL DEFAULT 'planning',
  limited_reason TEXT, error_code TEXT, retryable INTEGER NOT NULL DEFAULT 0,
  transcript_checked_at INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, request_id)
);
CREATE UNIQUE INDEX ai_analysis_active_project ON ai_analysis_tasks(project_id)
  WHERE status IN ('waiting','running','failed');
CREATE INDEX ai_analysis_pending ON ai_analysis_tasks(status, lease_until);
CREATE TABLE ai_analysis_steps (
  task_id TEXT NOT NULL REFERENCES ai_analysis_tasks(id), id TEXT NOT NULL, kind TEXT NOT NULL,
  input_key TEXT NOT NULL, ranges_json TEXT NOT NULL DEFAULT '[]', result_key TEXT, status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0, error_code TEXT, retryable INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(task_id,id)
);
CREATE TABLE ai_analysis_attempts (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL, step_id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'started', result_json TEXT, error_code TEXT
);
ALTER TABLE render_jobs ADD COLUMN priority INTEGER NOT NULL DEFAULT 1;
