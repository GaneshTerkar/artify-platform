-- Migration 011: Add IN_TRANSIT, DELIVERY_FAILED status enum values and delivery retry columns
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DELIVERY_FAILED';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_failure_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_delivery_attempt_at TIMESTAMPTZ;
