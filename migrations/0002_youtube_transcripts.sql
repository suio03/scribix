-- Add YouTube jobs and the more granular backend statuses used while
-- extracting/downloading temporary audio before AssemblyAI submission.

PRAGMA foreign_keys = OFF;

CREATE TABLE transcripts_new (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id),
  title                 TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'uploading', 'queued',
                                              'processing', 'extracting_audio',
                                              'uploading_audio', 'transcribing',
                                              'completed', 'error', 'failed')),
  source                TEXT NOT NULL
                            CHECK (source IN ('upload', 'record', 'youtube')),

  audio_r2_key          TEXT,
  transcript_r2_key     TEXT,

  filename              TEXT,
  mime_type             TEXT,
  bytes                 INTEGER,
  duration_sec          INTEGER,
  reserved_minutes      INTEGER,

  speech_model          TEXT NOT NULL,
  language              TEXT,
  aai_transcript_id     TEXT,
  webhook_token         TEXT NOT NULL,
  error                 TEXT,

  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at          DATETIME,
  deleted_at            DATETIME
);

INSERT INTO transcripts_new (
  id, user_id, title, status, source, audio_r2_key, transcript_r2_key,
  filename, mime_type, bytes, duration_sec, reserved_minutes, speech_model,
  language, aai_transcript_id, webhook_token, error, created_at, completed_at,
  deleted_at
)
SELECT
  id, user_id, title, status, source, audio_r2_key, transcript_r2_key,
  filename, mime_type, bytes, duration_sec, reserved_minutes, speech_model,
  language, aai_transcript_id, webhook_token, error, created_at, completed_at,
  deleted_at
FROM transcripts;

DROP TABLE transcripts;
ALTER TABLE transcripts_new RENAME TO transcripts;

CREATE INDEX idx_transcripts_user_created  ON transcripts(user_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_transcripts_status        ON transcripts(status);
CREATE INDEX idx_transcripts_aai_id        ON transcripts(aai_transcript_id);

PRAGMA foreign_keys = ON;
