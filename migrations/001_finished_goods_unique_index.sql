-- Migration: Add product_name_normalized column and create unique index for finished_goods_inventory
-- This migration is required for atomic UPSERT operations in the Finished Goods Inventory system
-- Run this migration in Supabase SQL Editor before deploying the code

-- Step 1: Add the product_name_normalized column if it doesn't exist
ALTER TABLE finished_goods_inventory 
ADD COLUMN IF NOT EXISTS product_name_normalized TEXT;

-- Step 2: Populate product_name_normalized for existing rows
UPDATE finished_goods_inventory 
SET product_name_normalized = lower(trim(product_name))
WHERE product_name_normalized IS NULL;

-- Step 3: Make the column NOT NULL after populating
ALTER TABLE finished_goods_inventory 
ALTER COLUMN product_name_normalized SET NOT NULL;

-- Step 4: Drop any old functional indexes that might conflict
DROP INDEX IF EXISTS finished_goods_unique_identity_idx;

-- Step 5: Create the standard unique index
-- This ensures unique inventory entries per branch + normalized product name + date
CREATE UNIQUE INDEX IF NOT EXISTS finished_goods_unique_idx 
ON finished_goods_inventory (branch_id, product_name_normalized, production_date);

-- Note: If you have duplicate rows that violate this constraint, 
-- run the following cleanup query first (before Step 5):
-- 
-- WITH duplicates AS (
--   SELECT id, 
--          branch_id, 
--          lower(trim(product_name)) as normalized_name,
--          production_date,
--          quantity,
--          ROW_NUMBER() OVER (
--            PARTITION BY branch_id, lower(trim(product_name)), production_date 
--            ORDER BY updated_at DESC
--          ) as rn
--   FROM finished_goods_inventory
-- )
-- DELETE FROM finished_goods_inventory 
-- WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
