-- Migration 013 Down: Rollback user_sessions, optimistic locking, and idempotency store
DROP TABLE IF EXISTS api_idempotency_keys CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS version;
DROP TABLE IF EXISTS user_sessions CASCADE;
