CREATE TABLE IF NOT EXISTS ai_usage_events (
  id                                              INTEGER PRIMARY KEY AUTOINCREMENT,
  feature                                         TEXT NOT NULL,
  request_status                                  TEXT NOT NULL CHECK (request_status IN ('success', 'failed')),
  request_id                                      TEXT NOT NULL,
  provider_response_id                            TEXT,
  provider_error_code                             TEXT,
  model                                           TEXT NOT NULL,
  service_tier                                    TEXT,
  user_id                                         TEXT,
  transcript_id                                   TEXT,
  plan_tier                                       TEXT NOT NULL,
  billing_cycle                                   TEXT,
  input_tokens                                    INTEGER NOT NULL CHECK (input_tokens >= 0),
  cached_input_tokens                             INTEGER NOT NULL CHECK (cached_input_tokens >= 0),
  uncached_input_tokens                           INTEGER NOT NULL CHECK (uncached_input_tokens >= 0),
  output_tokens                                   INTEGER NOT NULL CHECK (output_tokens >= 0),
  reasoning_tokens                                INTEGER NOT NULL CHECK (reasoning_tokens >= 0),
  total_tokens                                    INTEGER NOT NULL CHECK (total_tokens >= 0),
  uncached_input_price_microusd_per_million       INTEGER NOT NULL,
  cached_input_price_microusd_per_million         INTEGER NOT NULL,
  output_price_microusd_per_million               INTEGER NOT NULL,
  estimated_uncached_input_cost_microusd          INTEGER NOT NULL,
  estimated_cached_input_cost_microusd            INTEGER NOT NULL,
  estimated_output_cost_microusd                  INTEGER NOT NULL,
  estimated_total_cost_microusd                   INTEGER NOT NULL,
  created_at                                      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created_at
  ON ai_usage_events(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_id
  ON ai_usage_events(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_transcript_id
  ON ai_usage_events(transcript_id)
  WHERE transcript_id IS NOT NULL;
