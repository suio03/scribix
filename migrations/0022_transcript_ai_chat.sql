ALTER TABLE users
  ADD COLUMN ai_questions_used_this_period INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  transcript_id TEXT NOT NULL REFERENCES transcripts(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_transcript_user
  ON ai_chat_messages(transcript_id, user_id, id);
