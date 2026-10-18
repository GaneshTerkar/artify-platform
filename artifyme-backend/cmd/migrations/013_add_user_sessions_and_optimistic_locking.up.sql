-- Migration 013: Add user_sessions, optimistic locking version, and idempotency store

-- 1. Multi-Device Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  device_id VARCHAR(128) NOT NULL,
  device_name VARCHAR(128) DEFAULT 'Web Browser',
  device_type VARCHAR(32) DEFAULT 'DESKTOP',
  ip_address VARCHAR(64),
  user_agent TEXT,
  refresh_token_hash VARCHAR(256) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  CONSTRAINT uq_user_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_lookup ON user_sessions(user_id, is_revoked);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_hash ON user_sessions(refresh_token_hash);

-- 2. Optimistic Locking Version for Orders (Race Condition Prevention)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- 3. Idempotency Keys Storage
CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  key VARCHAR(128) PRIMARY KEY,
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  request_path VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PROCESSING',
  response_code INT,
  response_body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON api_idempotency_keys(key, expires_at);
