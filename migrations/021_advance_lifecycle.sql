-- 021: دورة حياة السلف الكاملة (مراجعة + توقيع الموظف + اعتماد نهائي + صرف + سلف سابقة)
-- نفّذ هذا الملف في Supabase SQL Editor قبل نشر التحديث على Render

ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS approved_amount real;
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS installment_months integer;
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS monthly_installment real;
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS start_month text;
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS sent_for_signature_by varchar REFERENCES users(id);
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS sent_for_signature_at timestamp;
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS signature_data text;
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS signed_at timestamp;
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS disbursed_by varchar REFERENCES users(id);
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS disbursed_at timestamp;
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS is_legacy boolean DEFAULT false;
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS legacy_repaid_amount real;

ALTER TABLE salary_deductions ADD COLUMN IF NOT EXISTS advance_request_id integer;
CREATE INDEX IF NOT EXISTS idx_salary_deductions_advance_request ON salary_deductions(advance_request_id);
