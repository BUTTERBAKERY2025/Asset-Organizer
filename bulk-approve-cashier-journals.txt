-- اعتماد جميع يوميات الكاشير التي حالتها "مسودة" دفعة واحدة
-- ينفَّذ مرة واحدة في Supabase SQL Editor
-- آمن: يعدّل فقط اليوميات ذات الحالة draft ولا يلمس أي يومية أخرى
-- المبالغ والعجز/الفائض تبقى كما سجّلها الكاشير (تبقى محسوبة عليه)

BEGIN;

-- (اختياري للتأكد قبل التنفيذ) عدد اليوميات المسودة:
-- SELECT COUNT(*) FROM cashier_sales_journals WHERE status = 'draft';

UPDATE cashier_sales_journals
SET status       = 'approved',
    submitted_at = COALESCE(submitted_at, NOW()),
    approved_by  = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1),
    approved_at  = NOW(),
    updated_at   = NOW()
WHERE status = 'draft';

COMMIT;

-- للتحقق بعد التنفيذ (يجب ألا يتبقى أي مسودة قديمة):
SELECT status, COUNT(*) AS العدد
FROM cashier_sales_journals
GROUP BY status;
