DROP TABLE IF EXISTS payment_events;

DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS uq_payments_provider_payment;
DROP INDEX IF EXISTS uq_payments_provider_order;

ALTER TABLE payments
  DROP COLUMN IF EXISTS raw_payload,
  DROP COLUMN IF EXISTS failure_reason,
  DROP COLUMN IF EXISTS provider_payment_id,
  DROP COLUMN IF EXISTS provider_order_id,
  DROP COLUMN IF EXISTS provider;
