-- Allows an uncertain AssemblyAI submit to be recovered from its unique
-- per-transcript webhook token when the submit response did not reach Scribix.

CREATE UNIQUE INDEX IF NOT EXISTS idx_transcripts_webhook_token
  ON transcripts(webhook_token);
