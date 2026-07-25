-- Persist the known source duration (browser-reported or AAI-inferred), the
-- server-authoritative end boundary, and explicit user consent for partial
-- processing. `duration_sec` remains the actual processed duration, clamped
-- to the server boundary.

ALTER TABLE transcripts ADD COLUMN source_duration_sec INTEGER;
ALTER TABLE transcripts ADD COLUMN processing_limit_sec INTEGER;
ALTER TABLE transcripts ADD COLUMN partial_requested INTEGER NOT NULL DEFAULT 0
  CHECK (partial_requested IN (0, 1));
