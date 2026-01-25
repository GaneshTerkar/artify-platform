-- Drop trigger first (depends on the function)
DROP TRIGGER IF EXISTS trg_update_user_name ON users;

-- Drop function used to generate user_name
DROP FUNCTION IF EXISTS update_user_name();
