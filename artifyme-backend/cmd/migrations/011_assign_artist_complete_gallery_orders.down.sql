-- Migration 011 Down: Revert gallery orders seed
DELETE FROM orders 
WHERE delivery_address = 'Artify Gallery Collection, Mumbai, Maharashtra 400001'
  AND updated_by = '18c95f7b-5c75-4d5f-8b79-cfe4c6b5df2d';
