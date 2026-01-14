-- IMPORTANT: connect to artifyme database
-- \c artifyme;

CREATE TYPE user_role AS ENUM ('ADMIN', 'ARTIST', 'USER');

CREATE TYPE painting_category AS ENUM (
    'PENCIL',
    'CHARCOAL',
    'OIL',
    'ACRYLIC',
    'WATERCOLOR'
);

CREATE TYPE order_status AS ENUM (
    'PLACED',
    'ASSIGNED',
    'IN_PROGRESS',
    'COMPLETED',
    'DELIVERED'
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE artist_profile (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL,
    bio TEXT,
    experience_years INT,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_artist_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE paintings (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    category painting_category NOT NULL,
    image_url TEXT NOT NULL,
    artist_id BIGINT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_painting_artist
        FOREIGN KEY (artist_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    artist_id BIGINT,
    category painting_category NOT NULL,
    reference_image_url TEXT NOT NULL,
    final_image_url TEXT,
    status order_status DEFAULT 'PLACED',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_user
        FOREIGN KEY (user_id)
        REFERENCES users(id),
    CONSTRAINT fk_order_artist
        FOREIGN KEY (artist_id)
        REFERENCES users(id)
);

CREATE TABLE order_status_history (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    status order_status NOT NULL,
    updated_by BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_paintings_category ON paintings(category);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_artist ON orders(artist_id);
