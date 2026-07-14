-- الاعتماد على مرحلتين لطلبات السلف (موافقة مبدئية من مدير التشغيل ثم قرار نهائي من شؤون الموظفين)
-- نفّذ هذا الملف يدوياً في Supabase SQL Editor قبل نشر الكود على Render.
-- آمن للتكرار (IF NOT EXISTS).

ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS pre_approved_by varchar REFERENCES users(id);
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS pre_approved_at timestamp;
ALTER TABLE advance_requests ADD COLUMN IF NOT EXISTS pre_approver_note text;
