CREATE TABLE IF NOT EXISTS youtube_inspect_rate_limits (
  user_id TEXT PRIMARY KEY NOT NULL,
  window_started_at INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_youtube_inspect_rate_limits_updated
  ON youtube_inspect_rate_limits(updated_at);
