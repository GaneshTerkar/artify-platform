-- Fix order status history trigger (orders PK is order_id, not id)
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS
$$ BEGIN
	IF NEW.status IS DISTINCT FROM OLD.status THEN
		INSERT INTO order_status_history (
			order_id,
			old_status,
			new_status,
			changed_by,
			note
		) VALUES (
			OLD.order_id,
			OLD.status,
			NEW.status,
			NEW.updated_by,
			'Status changed from ' || OLD.status || ' to ' || NEW.status
		);
	END IF;
	RETURN NEW;
END; $$
LANGUAGE plpgsql;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_notes TEXT;

CREATE TABLE IF NOT EXISTS payments (
  payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
