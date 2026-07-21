-- اعتماد يوميات الكاشير "المسودة" من 2026-01-01 إلى 2026-07-20 (شامل الطرفين) دفعة واحدة
-- ينفَّذ مرة واحدة في Supabase SQL Editor
-- آمن: يعدّل فقط اليوميات ذات الحالة draft وضمن هذه الفترة
-- أي يومية خارج هذه الفترة (قبل 2026-01-01 أو بعد 2026-07-20) تبقى كما هي دون أي تغيير
-- المبالغ والعجز/الفائض تبقى كما سجّلها الكاشير (تبقى محسوبة عليه)

BEGIN;

-- (اختياري للتأكد قبل التنفيذ) عدد اليوميات التي سيشملها الاعتماد:
-- SELECT COUNT(*) FROM cashier_sales_journals
-- WHERE status = 'draft' AND journal_date BETWEEN '2026-01-01' AND '2026-07-20';

UPDATE cashier_sales_journals
SET status       = 'approved',
    submitted_at = COALESCE(submitted_at, NOW()),
    approved_by  = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1),
    approved_at  = NOW(),
    updated_at   = NOW()
WHERE status = 'draft'
  AND journal_date BETWEEN '2026-01-01' AND '2026-07-20';

COMMIT;

-- للتحقق بعد التنفيذ:
SELECT status, COUNT(*) AS العدد
FROM cashier_sales_journals
GROUP BY status;

-- وللتأكد أن يوميات اليوم (2026-07-21 وما بعده) لم تتأثر:
SELECT journal_date, status, COUNT(*) AS العدد
FROM cashier_sales_journals
WHERE journal_date >= '2026-07-21'
GROUP BY journal_date, status
ORDER BY journal_date;
