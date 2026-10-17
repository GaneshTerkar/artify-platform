DROP INDEX IF EXISTS idx_payments_order_id;
DROP TABLE IF EXISTS payments;
ALTER TABLE orders DROP COLUMN IF EXISTS customer_notes;

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS
$$ BEGIN
	IF NEW.status IS DISTINCT FROM OLD.status
		THEN INSERT INTO order_status_history (
			order_id,
			old_status,
			new_status,
			changed_by,
			note
		) VALUES (
			OLD.id,
			OLD.status,
			NEW.status,
			NEW.updated_by,
			'Status changed from ' || OLD.status || ' to ' || NEW.status );
	END IF;
	RETURN NEW;
END; $$
LANGUAGE plpgsql;
