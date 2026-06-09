CREATE TABLE IF NOT EXISTS transcript_summaries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transcript_id  TEXT NOT NULL REFERENCES transcripts(id),
  user_id        TEXT NOT NULL REFERENCES users(id),
  status         TEXT NOT NULL DEFAULT 'processing'
                   CHECK (status IN ('processing', 'completed', 'error')),
  r2_key         TEXT,
  error          TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at   DATETIME,
  UNIQUE (transcript_id)
);

CREATE INDEX idx_transcript_summaries_user
  ON transcript_summaries(user_id, transcript_id);
