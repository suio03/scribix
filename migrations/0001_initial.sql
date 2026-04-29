-- Scribix v1 initial schema. Source of truth: docs/progress.md §5.

-- Users
CREATE TABLE users (
  id              TEXT PRIMARY KEY,                 -- Google profile.sub
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT,
  avatar_url      TEXT,
  country         TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Subscription state (single source of truth, no credit ledger)
  tier                   TEXT NOT NULL DEFAULT 'free'
                            CHECK (tier IN ('free', 'basic', 'pro')),
  billing_cycle          TEXT
                            CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'yearly')),
  customer_id            TEXT,                              -- Creem customer
  product_id             TEXT,                              -- current Creem product (null on free)
  subscription_status    TEXT
                            CHECK (subscription_status IS NULL
                                   OR subscription_status IN ('active', 'canceled', 'expired')),

  -- Quota counter (single counter, full reset on each Creem cycle event)
  minutes_used_this_period   INTEGER NOT NULL DEFAULT 0,
  period_started_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  period_ends_at             DATETIME NOT NULL,             -- next quota reset; always set on user creation

  -- Soft delete
  deleted_at      DATETIME
);
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_customer_id ON users(customer_id);

-- Transcripts (jobs)
CREATE TABLE transcripts (
  id                    TEXT PRIMARY KEY,            -- our UUID
  user_id               TEXT NOT NULL REFERENCES users(id),
  title                 TEXT NOT NULL,               -- defaults to filename, user-renamable
  status                TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'uploading', 'queued',
                                              'processing', 'completed', 'error')),
  source                TEXT NOT NULL
                            CHECK (source IN ('upload', 'record')),

  -- Files in R2
  audio_r2_key          TEXT,                        -- audio/{user_id}/{id}/source.{ext}; nullable after 7d auto-delete
  transcript_r2_key     TEXT,                        -- transcripts/{user_id}/{id}.json

  -- Audio metadata (filled at submit; finalized at completion)
  filename              TEXT,
  mime_type             TEXT,
  bytes                 INTEGER,
  duration_sec          INTEGER,                     -- final billed duration (capped by audio_end_at)
  reserved_minutes      INTEGER,                     -- minutes pre-deducted at submit; reconciled to actual at completion

  -- AssemblyAI handles
  speech_model          TEXT NOT NULL,               -- the model the transcript settled on after fallback
  language              TEXT,                        -- detected by AssemblyAI
  aai_transcript_id     TEXT,                        -- AssemblyAI's id
  webhook_token         TEXT NOT NULL,               -- per-job secret, validated on incoming webhook
  error                 TEXT,

  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at          DATETIME,
  deleted_at            DATETIME                     -- soft delete
);
CREATE INDEX idx_transcripts_user_created  ON transcripts(user_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_transcripts_status        ON transcripts(status);
CREATE INDEX idx_transcripts_aai_id        ON transcripts(aai_transcript_id);

-- Webhook event dedup (Creem)
CREATE TABLE processed_creem_events (
  event_id     TEXT PRIMARY KEY,
  received_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
