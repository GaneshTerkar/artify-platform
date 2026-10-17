-- Migration 010: Add collage image URL and gallery confirmation columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS collage_image_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_published_to_gallery BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_final_image_url TEXT;
