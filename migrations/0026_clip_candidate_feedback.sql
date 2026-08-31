CREATE TABLE clip_candidate_feedback_events (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  project_id    TEXT NOT NULL REFERENCES video_projects(id),
  candidate_id  TEXT NOT NULL,
  feedback      TEXT NOT NULL CHECK (feedback IN ('accepted', 'rejected')),
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clip_candidate_feedback_project_created
  ON clip_candidate_feedback_events(project_id, created_at DESC);

CREATE INDEX idx_clip_candidate_feedback_user_created
  ON clip_candidate_feedback_events(user_id, created_at DESC);
