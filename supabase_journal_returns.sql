-- Journal Returns Fields - حقول المرتجع في يومية الكاشير
-- Execute this SQL in Supabase SQL Editor before deploying

-- Add return fields to cashier_sales_journals table
ALTER TABLE cashier_sales_journals 
ADD COLUMN IF NOT EXISTS return_amount REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_payment_method TEXT,
ADD COLUMN IF NOT EXISTS return_reason TEXT,
ADD COLUMN IF NOT EXISTS return_reference TEXT,
ADD COLUMN IF NOT EXISTS has_return BOOLEAN DEFAULT FALSE;

-- Create index for journals with returns
CREATE INDEX IF NOT EXISTS idx_journals_has_return ON cashier_sales_journals(has_return) WHERE has_return = TRUE;
