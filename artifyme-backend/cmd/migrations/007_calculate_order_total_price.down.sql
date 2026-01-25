-- Drop trigger first (depends on the function)
DROP TRIGGER IF EXISTS trg_orders_total_price ON orders;

-- Drop function used to calculate order total price
DROP FUNCTION IF EXISTS calculate_order_total_price();
