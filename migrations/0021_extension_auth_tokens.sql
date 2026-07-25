CREATE TABLE IF NOT EXISTS extension_auth_codes (
  code_hash      TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri   TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  client         TEXT NOT NULL CHECK (client IN ('chrome', 'edge', 'firefox')),
  expires_at     INTEGER NOT NULL,
  used_at        INTEGER,
  created_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_extension_auth_codes_user
  ON extension_auth_codes(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_extension_auth_codes_expiry
  ON extension_auth_codes(expires_at);

CREATE TABLE IF NOT EXISTS extension_auth_sessions (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client             TEXT NOT NULL CHECK (client IN ('chrome', 'edge', 'firefox')),
  access_token_hash  TEXT NOT NULL UNIQUE,
  access_expires_at  INTEGER NOT NULL,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  refresh_expires_at INTEGER NOT NULL,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  last_used_at       INTEGER NOT NULL,
  revoked_at         INTEGER
);

CREATE INDEX IF NOT EXISTS idx_extension_auth_sessions_user
  ON extension_auth_sessions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_extension_auth_sessions_expiry
  ON extension_auth_sessions(refresh_expires_at);
