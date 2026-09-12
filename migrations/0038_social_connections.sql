CREATE TABLE social_connection_returns (
  state_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT NOT NULL REFERENCES video_projects(id),
  locale TEXT NOT NULL CHECK(locale IN ('en', 'fr', 'es', 'it', 'ja', 'de')),
  connection_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'checking', 'connected', 'failed')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_social_connection_returns_user ON social_connection_returns(user_id, created_at);
