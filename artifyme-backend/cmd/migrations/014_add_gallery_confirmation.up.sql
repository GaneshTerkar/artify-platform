-- Migration 014: Add gallery publication confirmation to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_published_to_gallery BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_final_image_url TEXT;
