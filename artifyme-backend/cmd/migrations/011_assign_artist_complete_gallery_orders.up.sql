-- Migration 011: Assign verified artist to all orders and mark gallery paintings as completed orders

-- 1. Ensure existing artist (Ganesh Artist) is ACTIVE and verified
UPDATE users
SET status = 'ACTIVE'
WHERE user_id = 'e8d28200-9727-4246-b5a8-b4debd00710c';

UPDATE artist_profiles
SET verified = TRUE, updated_at = NOW()
WHERE artist_id = 'e8d28200-9727-4246-b5a8-b4debd00710c';

-- 2. Assign existing pending/placed orders to the verified artist and mark as COMPLETED
UPDATE orders
SET
    artist_id = 'e8d28200-9727-4246-b5a8-b4debd00710c',
    status = 'COMPLETED',
    final_image_url = COALESCE(NULLIF(final_image_url, ''), reference_image_url),
    updated_at = NOW(),
    updated_by = '18c95f7b-5c75-4d5f-8b79-cfe4c6b5df2d'
WHERE status != 'COMPLETED' OR artist_id IS NULL OR final_image_url IS NULL OR TRIM(final_image_url) = '';

-- 3. Register all 22 gallery paintings into the orders table as COMPLETED orders assigned to Ganesh Artist
INSERT INTO orders (
    user_id,
    artist_id,
    painting_category,
    reference_image_url,
    final_image_url,
    size,
    persons_included,
    status,
    delivery_address,
    customer_notes,
    created_at,
    updated_at,
    updated_by
)
SELECT
    '28f23beb-4c2a-4719-a1cc-4ef380c9813c'::uuid,
    'e8d28200-9727-4246-b5a8-b4debd00710c'::uuid,
    ap.category,
    ap.image_url,
    ap.image_url,
    'A3'::painting_size,
    'SINGLE'::person_included,
    'COMPLETED'::order_status,
    'Artify Gallery Collection, Mumbai, Maharashtra 400001',
    ap.title || ' — ' || ap.description,
    ap.created_at,
    ap.created_at,
    '18c95f7b-5c75-4d5f-8b79-cfe4c6b5df2d'::uuid
FROM artist_paintings ap
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.final_image_url = ap.image_url
);
