-- Migration: 015_add_logistics_and_customer_reviews.down.sql

DROP TABLE IF EXISTS reviews;

DROP INDEX IF EXISTS idx_orders_tracking_number;

ALTER TABLE orders 
DROP COLUMN IF EXISTS courier_partner,
DROP COLUMN IF EXISTS tracking_number,
DROP COLUMN IF EXISTS estimated_delivery_at,
DROP COLUMN IF EXISTS admin_dispatch_notes;
