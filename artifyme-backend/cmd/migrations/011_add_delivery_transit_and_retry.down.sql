ALTER TABLE orders DROP COLUMN IF EXISTS last_delivery_attempt_at;
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_failure_reason;
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_attempts;
