-- Migration: Create functional unique index for finished_goods_inventory
-- This index is required for atomic UPSERT operations in the Finished Goods Inventory system
-- Run this migration in Supabase SQL Editor before deploying the code

-- Drop any conflicting indexes first (if they exist)
DROP INDEX IF EXISTS finished_goods_unique_idx;
DROP INDEX IF EXISTS idx_finished_goods_unique;

-- Create the functional unique index
-- This ensures unique inventory entries per branch + product identity + date
-- When product_id is present, it's used as the identity
-- When product_id is NULL, the normalized product_name is used
CREATE UNIQUE INDEX IF NOT EXISTS finished_goods_unique_identity_idx 
ON finished_goods_inventory (
  branch_id, 
  COALESCE(product_id::text, lower(trim(product_name))), 
  production_date
);

-- Note: If you have duplicate rows that violate this constraint, 
-- run the following cleanup query first to merge them:
-- 
-- WITH duplicates AS (
--   SELECT id, 
--          branch_id, 
--          COALESCE(product_id::text, lower(trim(product_name))) as identity_key,
--          production_date,
--          quantity,
--          ROW_NUMBER() OVER (
--            PARTITION BY branch_id, COALESCE(product_id::text, lower(trim(product_name))), production_date 
--            ORDER BY updated_at DESC
--          ) as rn
--   FROM finished_goods_inventory
-- )
-- DELETE FROM finished_goods_inventory 
-- WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
