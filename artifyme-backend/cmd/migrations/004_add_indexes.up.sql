-- USERS 
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_name ON users(user_name);

-- ARTISTS
CREATE INDEX idx_artist_profiles_verified ON artist_profiles(verified);

-- ARTIST PAINTINGS
CREATE INDEX idx_artist_paintings_category ON artist_paintings(category);

-- ORDERS
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_artist ON orders(artist_id);
CREATE INDEX idx_orders_delivery_agent ON orders(delivery_agent_id);

-- NOTIFICATIONS
CREATE INDEX idx_notifications_user ON notifications(user_id);