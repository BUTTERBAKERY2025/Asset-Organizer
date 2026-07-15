-- 022: ترحيل عجوزات يوميات المبيعات للكاشير إلى السلف والقروض
-- نفّذ هذا الملف في Supabase SQL Editor قبل نشر التحديث على Render

ALTER TABLE cashier_sales_journals ADD COLUMN IF NOT EXISTS deficit_deduction_id integer;
ALTER TABLE cashier_sales_journals ADD COLUMN IF NOT EXISTS deficit_posted_by varchar REFERENCES users(id);
ALTER TABLE cashier_sales_journals ADD COLUMN IF NOT EXISTS deficit_posted_at timestamp;
CREATE INDEX IF NOT EXISTS idx_cashier_journals_deficit_posted ON cashier_sales_journals(deficit_deduction_id);
