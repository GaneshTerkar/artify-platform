-- Migration 012: Remove duplicated orders and ensure single-source authentic paintings

-- 1. Remove synthetic duplicate orders created from gallery paintings
DELETE FROM orders 
WHERE delivery_address = 'Artify Gallery Collection, Mumbai, Maharashtra 400001';

-- 2. Reset customer test orders: reference images are customer inputs, not completed artworks
UPDATE orders
SET 
    status = CASE 
        WHEN order_id = 'daa35e42-d234-4350-973d-f1feba0f2cda' THEN 'IN_PROGRESS'::order_status 
        ELSE 'PLACED'::order_status 
    END,
    final_image_url = NULL,
    updated_at = NOW(),
    updated_by = '18c95f7b-5c75-4d5f-8b79-cfe4c6b5df2d'
WHERE final_image_url IS NOT NULL;

-- 3. Ensure all 22 authentic gallery paintings in artist_paintings are attributed to verified artist
UPDATE artist_paintings
SET 
    artist_id = 'e8d28200-9727-4246-b5a8-b4debd00710c',
    updated_at = NOW()
WHERE artist_id != 'e8d28200-9727-4246-b5a8-b4debd00710c' OR artist_id IS NULL;
