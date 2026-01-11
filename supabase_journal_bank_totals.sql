-- إضافة حقول إجمالي البنك للتسوية الشاملة
-- Execute this in Supabase SQL Editor

-- 1. Add columns if they don't exist
DO $$ 
BEGIN
    -- Add total_bank_pos_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cashier_sales_journals' 
                   AND column_name = 'total_bank_pos_amount') THEN
        ALTER TABLE cashier_sales_journals 
        ADD COLUMN total_bank_pos_amount REAL DEFAULT 0;
    END IF;
    
    -- Add total_bank_terminal_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cashier_sales_journals' 
                   AND column_name = 'total_bank_terminal_amount') THEN
        ALTER TABLE cashier_sales_journals 
        ADD COLUMN total_bank_terminal_amount REAL DEFAULT 0;
    END IF;
END $$;

-- 2. Backfill existing journals by calculating terminal totals from payment breakdowns
-- This updates journals where the values are NULL or 0
UPDATE cashier_sales_journals j
SET 
    total_bank_pos_amount = COALESCE((
        SELECT SUM(pb.amount)
        FROM cashier_payment_breakdowns pb
        WHERE pb.journal_id = j.id
        AND pb.payment_method IN ('card', 'mada', 'stc_pay', 'apple_pay', 'visa', 'mastercard')
    ), 0),
    total_bank_terminal_amount = COALESCE((
        SELECT SUM(pb.terminal_amount)
        FROM cashier_payment_breakdowns pb
        WHERE pb.journal_id = j.id
        AND pb.payment_method IN ('card', 'mada', 'stc_pay', 'apple_pay', 'visa', 'mastercard')
    ), 0)
WHERE (total_bank_pos_amount IS NULL OR total_bank_pos_amount = 0)
   OR (total_bank_terminal_amount IS NULL OR total_bank_terminal_amount = 0);

-- 3. Verify the update
SELECT 
    id,
    journal_date,
    cashier_name,
    total_sales,
    actual_cash_drawer,
    total_bank_pos_amount,
    total_bank_terminal_amount,
    (actual_cash_drawer + COALESCE(total_bank_terminal_amount, 0)) - (total_sales - COALESCE(return_amount, 0)) as net_variance
FROM cashier_sales_journals
ORDER BY id DESC
LIMIT 10;
