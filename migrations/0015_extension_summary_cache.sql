CREATE TABLE IF NOT EXISTS extension_youtube_summary_cache (
  cache_key TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  transcript_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  r2_key TEXT,
  error TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_extension_youtube_summary_cache_user
  ON extension_youtube_summary_cache(user_id, video_id, language_code);
