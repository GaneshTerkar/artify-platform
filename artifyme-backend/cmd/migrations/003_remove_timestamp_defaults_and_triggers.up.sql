-- DROP DEFAULTS
ALTER TABLE users
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN updated_at DROP DEFAULT;

ALTER TABLE artist_profiles
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN updated_at DROP DEFAULT;

ALTER TABLE artist_paintings
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN updated_at DROP DEFAULT;

ALTER TABLE orders
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN updated_at DROP DEFAULT;

ALTER TABLE order_status_history
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN updated_at DROP DEFAULT;

ALTER TABLE notifications
  ALTER COLUMN created_at DROP DEFAULT;

ALTER TABLE files
  ALTER COLUMN created_at DROP DEFAULT;

-- DROP TRIGGERS
DROP TRIGGER IF EXISTS trg_users_updated ON users;
DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
DROP TRIGGER IF EXISTS trg_artist_paintings_updated ON artist_paintings;
DROP TRIGGER IF EXISTS trg_artist_profiles_updated ON artist_profiles;
DROP TRIGGER IF EXISTS trg_order_status_history_updated ON order_status_history;
