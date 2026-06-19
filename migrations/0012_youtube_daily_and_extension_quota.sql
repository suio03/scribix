ALTER TABLE users
  ADD COLUMN youtube_imports_period_started_at DATETIME;

CREATE TABLE IF NOT EXISTS youtube_extension_quotas (
  client_id TEXT PRIMARY KEY NOT NULL,
  youtube_imports_used_today INTEGER NOT NULL DEFAULT 0,
  period_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_youtube_extension_quotas_updated
  ON youtube_extension_quotas(updated_at);
