-- Migration: 015_add_logistics_and_customer_reviews.up.sql

-- 1. Add courier partner and live tracking fields to orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS courier_partner VARCHAR(100),
ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS estimated_delivery_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_dispatch_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);

-- 2. Create customer verified reviews table
CREATE TABLE IF NOT EXISTS reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    artist_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(150),
    comment TEXT NOT NULL,
    unboxing_photo_url TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT TRUE,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_artist_id ON reviews(artist_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_is_featured ON reviews(is_featured);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
