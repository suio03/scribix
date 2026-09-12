ALTER TABLE media_assets ADD COLUMN social_hold_until INTEGER NOT NULL DEFAULT 0;
CREATE TABLE social_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT NOT NULL REFERENCES video_projects(id),
  render_job_id TEXT NOT NULL REFERENCES render_jobs(id),
  request_hash TEXT NOT NULL,
  request_encrypted TEXT,
  remote_post_id TEXT,
  result_json TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_social_submissions_user ON social_submissions(user_id, project_id, created_at);
