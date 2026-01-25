-- Drop trigger first (must be removed before the function)
DROP TRIGGER IF EXISTS trg_log_order_status_change ON orders;

-- Drop function used by the trigger
DROP FUNCTION IF EXISTS log_order_status_change();
