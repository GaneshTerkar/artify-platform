-- Function to calculate order total price
CREATE OR REPLACE FUNCTION calculate_order_total_price()
RETURNS TRIGGER AS
$$ BEGIN
	NEW.total_price := LEAST(5000.00, 1500.00 * 
		CASE NEW.painting_category
			WHEN 'PENCIL' THEN 1.0
			WHEN 'CHARCOAL' THEN 1.2
			WHEN 'OIL' THEN 1.8
			WHEN 'ACRYLIC' THEN 1.5
			WHEN 'WATERCOLOR' THEN 1.3
		END *
		CASE NEW.size
			WHEN 'A4' THEN 1.0
			WHEN 'A3' THEN 2.0
			WHEN 'A2' THEN 3.0
		END *
		CASE NEW.persons_included
			WHEN 'SINGLE' THEN 1.0
			WHEN 'COUPLE' THEN 1.3
			WHEN 'FAMILY' THEN 1.6
		END ) + 50.00;
	RETURN NEW;
END; $$
LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_total_price
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION calculate_order_total_price();