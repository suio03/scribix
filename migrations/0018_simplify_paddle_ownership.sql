-- Remove the monetary columns from locally applied versions of migration 0016.
-- Paddle is the financial source of truth; Scribix keeps ownership metadata only.

PRAGMA foreign_keys = OFF;

CREATE TABLE paddle_checkout_intents_backup AS
SELECT transaction_id, user_id, tier, billing_cycle, client_observed_at, created_at
FROM paddle_checkout_intents;

CREATE TABLE paddle_transactions_backup AS
SELECT transaction_id, user_id, customer_id, subscription_id, tier, billing_cycle,
       status, occurred_at, created_at, updated_at
FROM paddle_transactions;

CREATE TABLE paddle_adjustments_backup AS
SELECT adjustment_id, transaction_id, action, status, occurred_at, created_at, updated_at
FROM paddle_adjustments;

DROP TABLE paddle_adjustments;
DROP TABLE paddle_transactions;
DROP TABLE paddle_checkout_intents;

CREATE TABLE paddle_checkout_intents (
  transaction_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'pro')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  client_observed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_paddle_checkout_intents_user
  ON paddle_checkout_intents(user_id, created_at);

CREATE TABLE paddle_transactions (
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

CREATE INDEX idx_paddle_transactions_user
  ON paddle_transactions(user_id, occurred_at);
CREATE INDEX idx_paddle_transactions_subscription
  ON paddle_transactions(subscription_id);

CREATE TABLE paddle_adjustments (
  adjustment_id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES paddle_transactions(transaction_id),
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  occurred_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_paddle_adjustments_transaction
  ON paddle_adjustments(transaction_id, occurred_at);

INSERT INTO paddle_checkout_intents
  (transaction_id, user_id, tier, billing_cycle, client_observed_at, created_at)
SELECT transaction_id, user_id, tier, billing_cycle, client_observed_at, created_at
FROM paddle_checkout_intents_backup;

INSERT INTO paddle_transactions
  (transaction_id, user_id, customer_id, subscription_id, tier, billing_cycle,
   status, occurred_at, created_at, updated_at)
SELECT transaction_id, user_id, customer_id, subscription_id, tier, billing_cycle,
       status, occurred_at, created_at, updated_at
FROM paddle_transactions_backup;

INSERT INTO paddle_adjustments
  (adjustment_id, transaction_id, action, status, occurred_at, created_at, updated_at)
SELECT adjustment_id, transaction_id, action, status, occurred_at, created_at, updated_at
FROM paddle_adjustments_backup;

DROP TABLE paddle_adjustments_backup;
DROP TABLE paddle_transactions_backup;
DROP TABLE paddle_checkout_intents_backup;

PRAGMA foreign_keys = ON;
