-- Existing subscriptions retain their current entitlements. A null version is
-- intentionally interpreted as legacy, including subscriptions from older
-- Paddle products that are not offered to new customers.
ALTER TABLE users ADD COLUMN plan_version TEXT
  CHECK (plan_version IS NULL OR plan_version IN ('legacy', 'v2'));
