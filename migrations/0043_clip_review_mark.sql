-- Review decisions are independent from the active editing candidate.
ALTER TABLE clip_candidates ADD COLUMN review_mark TEXT CHECK (review_mark IN ('keep', 'discard'));
