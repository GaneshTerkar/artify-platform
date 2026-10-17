ALTER TABLE orders
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE order_status_history
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE orders SET created_at = NOW() WHERE created_at IS NULL;
UPDATE orders SET updated_at = NOW() WHERE updated_at IS NULL;
