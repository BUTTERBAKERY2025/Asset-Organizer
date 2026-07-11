-- إضافة عمود حالة الموظف إلى سطور إغلاق الرواتب (لقطة ثابتة وقت الإغلاق)
-- آمن وقابل لإعادة التنفيذ (idempotent) — نفّذه في Supabase SQL Editor قبل نشر الكود على Render
ALTER TABLE salary_closure_lines ADD COLUMN IF NOT EXISTS employee_status text;
