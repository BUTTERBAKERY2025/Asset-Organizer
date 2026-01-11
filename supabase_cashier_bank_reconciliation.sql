-- Cashier Bank Reconciliation Enhancement
-- Execute this in Supabase SQL Editor before deploying

-- Add bank reconciliation summary fields to cashier_sales_journals
ALTER TABLE cashier_sales_journals 
ADD COLUMN IF NOT EXISTS total_bank_pos_amount REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_bank_terminal_amount REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS bank_discrepancy_total REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS bank_discrepancy_status TEXT DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS is_input_error BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS input_error_amount REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_discrepancy REAL DEFAULT 0;

-- Add bank reconciliation fields to cashier_payment_breakdowns
ALTER TABLE cashier_payment_breakdowns 
ADD COLUMN IF NOT EXISTS pos_amount REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS terminal_amount REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS bank_discrepancy REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS bank_discrepancy_type TEXT DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS terminal_transaction_count INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN cashier_sales_journals.total_bank_pos_amount IS 'إجمالي المدفوعات البنكية من الكاشير';
COMMENT ON COLUMN cashier_sales_journals.total_bank_terminal_amount IS 'إجمالي المدفوعات البنكية من جهاز البنك';
COMMENT ON COLUMN cashier_sales_journals.bank_discrepancy_total IS 'إجمالي الفرق البنكي';
COMMENT ON COLUMN cashier_sales_journals.bank_discrepancy_status IS 'حالة المطابقة البنكية: balanced, shortage, surplus';
COMMENT ON COLUMN cashier_sales_journals.is_input_error IS 'هل الفرق بسبب خطأ إدخال (عجز نقدي = زيادة بنكية)';
COMMENT ON COLUMN cashier_sales_journals.input_error_amount IS 'مبلغ خطأ الإدخال المحتمل';
COMMENT ON COLUMN cashier_sales_journals.net_discrepancy IS 'صافي الفرق بعد احتساب خطأ الإدخال';

COMMENT ON COLUMN cashier_payment_breakdowns.pos_amount IS 'المبلغ من نظام نقاط البيع (POS)';
COMMENT ON COLUMN cashier_payment_breakdowns.terminal_amount IS 'المبلغ من جهاز الصراف البنكي (Terminal)';
COMMENT ON COLUMN cashier_payment_breakdowns.bank_discrepancy IS 'الفرق بين POS والتيرمنال';
COMMENT ON COLUMN cashier_payment_breakdowns.bank_discrepancy_type IS 'نوع الفرق: balanced, shortage, surplus';
COMMENT ON COLUMN cashier_payment_breakdowns.terminal_transaction_count IS 'عدد العمليات من جهاز البنك';
