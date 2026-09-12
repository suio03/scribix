CREATE TABLE social_connection_returns_new (
  state_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES video_projects(id),
  locale TEXT NOT NULL CHECK(locale IN ('en', 'fr', 'es', 'it', 'ja', 'de')),
  connection_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'checking', 'connected', 'failed')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
INSERT INTO social_connection_returns_new SELECT * FROM social_connection_returns;
DROP TABLE social_connection_returns;
ALTER TABLE social_connection_returns_new RENAME TO social_connection_returns;
CREATE INDEX idx_social_connection_returns_user ON social_connection_returns(user_id, created_at);
