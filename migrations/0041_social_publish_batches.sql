ALTER TABLE social_submissions ADD COLUMN batch_id TEXT;
ALTER TABLE social_submissions ADD COLUMN display_json TEXT;
CREATE INDEX idx_social_submissions_batch ON social_submissions(user_id, batch_id);
