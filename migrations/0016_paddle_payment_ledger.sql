-- Durable Paddle checkout intent, transaction ownership, and adjustment records.
-- Paddle remains the financial source of truth; no monetary amounts are copied here.

CREATE TABLE IF NOT EXISTS paddle_checkout_intents (
  transaction_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'pro')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  client_observed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_paddle_checkout_intents_user
  ON paddle_checkout_intents(user_id, created_at);

CREATE TABLE IF NOT EXISTS paddle_transactions (
  transaction_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  customer_id TEXT,
  subscription_id TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'pro')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  status TEXT NOT NULL,
  occurred_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_paddle_transactions_user
  ON paddle_transactions(user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_paddle_transactions_subscription
  ON paddle_transactions(subscription_id);

CREATE TABLE IF NOT EXISTS paddle_adjustments (
  adjustment_id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES paddle_transactions(transaction_id),
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  occurred_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_paddle_adjustments_transaction
  ON paddle_adjustments(transaction_id, occurred_at);
