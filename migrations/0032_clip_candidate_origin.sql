-- Distinguish AI recommendations from the non-scored source-video editor entry.

ALTER TABLE clip_candidates ADD COLUMN origin TEXT NOT NULL DEFAULT 'ai'
  CHECK (origin IN ('ai', 'manual'));
