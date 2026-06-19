CREATE TABLE IF NOT EXISTS youtube_extension_ip_quotas (
  ip_key TEXT PRIMARY KEY NOT NULL,
  youtube_imports_used_today INTEGER NOT NULL DEFAULT 0,
  period_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_youtube_extension_ip_quotas_updated
  ON youtube_extension_ip_quotas(updated_at);
