-- Persist anonymous framing decisions with the source proxy that was analyzed.
ALTER TABLE media_assets ADD COLUMN auto_framing_json TEXT;
