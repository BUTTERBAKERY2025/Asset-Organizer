-- =============================================================
-- تحديث قاعدة بيانات الإنتاج (Supabase) — معالجة فجوات نظام الإجازات
-- نفّذ هذا الملف في Supabase SQL Editor قبل نشر الكود على Render
-- التاريخ: 2026-07-12
-- =============================================================

-- 1) أعمدة خصم الإجازات المرضية في سطور إقفال الرواتب (المادة 117)
ALTER TABLE salary_closure_lines ADD COLUMN IF NOT EXISTS sick_leave_deduction real DEFAULT 0;
ALTER TABLE salary_closure_lines ADD COLUMN IF NOT EXISTS sick_three_quarter_days real DEFAULT 0;
ALTER TABLE salary_closure_lines ADD COLUMN IF NOT EXISTS sick_unpaid_days real DEFAULT 0;

-- لا توجد تغييرات أخرى على الجداول.
-- ملاحظة: حسابات "مخصص الإجازات" (2310 و 5210) تُضاف تلقائياً في شجرة
-- الحسابات عند أول استخدام لزر "إنشاء قيد المخصص" — لا تحتاج SQL يدوي.
