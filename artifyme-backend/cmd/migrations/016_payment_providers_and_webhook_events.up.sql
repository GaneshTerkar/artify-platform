-- 016: provider-agnostic payments (Razorpay) + webhook event log

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- Rows created by the old mock checkout are dev artefacts, not real payments.
UPDATE payments
SET provider = 'dev'
WHERE provider = 'stripe'
  AND stripe_session_id LIKE 'dev_session_%';

UPDATE payments
SET provider_order_id = COALESCE(provider_order_id, stripe_session_id)
WHERE provider_order_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_order
  ON payments (provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_payment
  ON payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);

CREATE TABLE IF NOT EXISTS payment_events (
  event_id     TEXT PRIMARY KEY,
  provider     VARCHAR(20) NOT NULL,
  event_type   TEXT,
  payload      JSONB,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_events_received_at
  ON payment_events (received_at DESC);
