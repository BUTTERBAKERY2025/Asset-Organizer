-- Migration: Add return columns to cashier_journals table
-- Run this in Supabase SQL Editor BEFORE deploying code updates

-- Add return_amount column
ALTER TABLE cashier_journals 
ADD COLUMN IF NOT EXISTS return_amount REAL DEFAULT 0;

-- Add return_payment_method column
ALTER TABLE cashier_journals 
ADD COLUMN IF NOT EXISTS return_payment_method TEXT;

-- Add return_reason column
ALTER TABLE cashier_journals 
ADD COLUMN IF NOT EXISTS return_reason TEXT;

-- Add return_reference column
ALTER TABLE cashier_journals 
ADD COLUMN IF NOT EXISTS return_reference TEXT;

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'cashier_journals' 
AND column_name IN ('return_amount', 'return_payment_method', 'return_reason', 'return_reference');
