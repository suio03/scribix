ALTER TABLE users ADD COLUMN subscription_id TEXT;
CREATE INDEX idx_users_subscription_id ON users(subscription_id);
