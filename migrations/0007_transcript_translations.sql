CREATE TABLE IF NOT EXISTS transcript_translations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transcript_id  TEXT NOT NULL REFERENCES transcripts(id),
  user_id        TEXT NOT NULL REFERENCES users(id),
  lang           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'processing'
                   CHECK (status IN ('processing', 'completed', 'error')),
  r2_key         TEXT,
  error          TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at   DATETIME,
  UNIQUE (transcript_id, lang)
);

CREATE INDEX idx_transcript_translations_user
  ON transcript_translations(user_id, transcript_id);
