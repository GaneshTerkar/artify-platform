-- No automatic rollback (intentional)
-- This migration is irreversible by design
-- RESTORE DEFAULTS (timestamps)

ALTER TABLE users
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE artist_profiles
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE artist_paintings
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE orders
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE order_status_history
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE notifications
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE files
  ALTER COLUMN created_at SET DEFAULT NOW();
