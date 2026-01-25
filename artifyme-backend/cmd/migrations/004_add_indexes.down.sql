-- USERS
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_user_name;

-- ARTISTS
DROP INDEX IF EXISTS idx_artist_profiles_verified;

-- ARTIST PAINTINGS
DROP INDEX IF EXISTS idx_artist_paintings_category;

-- ORDERS
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_user;
DROP INDEX IF EXISTS idx_orders_artist;
DROP INDEX IF EXISTS idx_orders_delivery_agent;

-- NOTIFICATIONS
DROP INDEX IF EXISTS idx_notifications_user;
