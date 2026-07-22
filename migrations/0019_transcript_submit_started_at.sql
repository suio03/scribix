-- Track the AAI submission window separately from long browser uploads so
-- stranded-submit recovery does not mistake an old upload for an old submit.

ALTER TABLE transcripts ADD COLUMN submit_started_at DATETIME;
