-- Privacy-bounded product events for the staged video-workspace release.

CREATE TABLE video_workspace_events (
  id             TEXT PRIMARY KEY,
  event_key      TEXT NOT NULL,
  user_id        TEXT NOT NULL REFERENCES users(id),
  project_id     TEXT NOT NULL REFERENCES video_projects(id),
  candidate_id   TEXT,
  render_job_id  TEXT REFERENCES render_jobs(id),
  event_name     TEXT NOT NULL CHECK (event_name IN (
                   'editor_opened', 'edit_saved', 'render_requested',
                   'render_completed', 'render_failed', 'render_downloaded',
                   'external_edit_required'
                 )),
  properties_json TEXT NOT NULL DEFAULT '{}',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, event_key)
);

CREATE INDEX idx_video_workspace_events_name_created
  ON video_workspace_events(event_name, created_at DESC);

CREATE INDEX idx_video_workspace_events_project_created
  ON video_workspace_events(project_id, created_at DESC);

CREATE INDEX idx_video_workspace_events_render
  ON video_workspace_events(render_job_id, event_name)
  WHERE render_job_id IS NOT NULL;
