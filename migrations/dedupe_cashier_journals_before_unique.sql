-- =================================================================
-- خطوات تنظيف اليوميات المكررة قبل تشغيل add_cashier_journal_integrity_constraints.sql
-- =================================================================
-- شغّل كل خطوة على حدة وافحص النتيجة قبل الانتقال للتالية.
-- ابدأ على DEV أولاً، تأكد من النتيجة، ثم كرّر على PROD.

-- =================================================================
-- خطوة 1: عرض جميع المكررات في cashier_sales_journals
-- =================================================================
-- النتيجة المتوقعة: قائمة المجموعات التي بها أكثر من سجل واحد
SELECT
  branch_id,
  cashier_id,
  journal_date,
  COALESCE(shift_type, '') AS shift_type,
  COUNT(*) AS dup_count,
  array_agg(id ORDER BY id) AS journal_ids,
  array_agg(status ORDER BY id) AS statuses,
  array_agg(total_sales ORDER BY id) AS totals,
  array_agg(created_at ORDER BY id) AS created_dates
FROM cashier_sales_journals
GROUP BY branch_id, cashier_id, journal_date, COALESCE(shift_type, '')
HAVING COUNT(*) > 1
ORDER BY journal_date DESC, branch_id;

-- =================================================================
-- خطوة 2 (اختياري): فحص اليومية المحددة من الخطأ
-- =================================================================
SELECT id, status, total_sales, cash_total, transaction_count,
       customer_count, created_at, updated_at, created_by
FROM cashier_sales_journals
WHERE branch_id = 'JAZAN'
  AND cashier_id = '066062a8-a427-448c-9d02-7df0084e3066'
  AND journal_date = '2026-01-16'
  AND COALESCE(shift_type, '') = 'morning'
ORDER BY id;

-- =================================================================
-- خطوة 3: فحص ارتباطات اليوميات المكررة بالإقفال اليومي
-- (لا تحذف يومية مربوطة بإقفال!)
-- =================================================================
SELECT j.id AS journal_id, j.branch_id, j.journal_date, j.status,
       j.total_sales, bdcj.closure_id
FROM cashier_sales_journals j
LEFT JOIN branch_daily_closure_journals bdcj ON bdcj.journal_id = j.id
WHERE (j.branch_id, j.cashier_id, j.journal_date, COALESCE(j.shift_type, '')) IN (
  SELECT branch_id, cashier_id, journal_date, COALESCE(shift_type, '')
  FROM cashier_sales_journals
  GROUP BY 1,2,3,4
  HAVING COUNT(*) > 1
)
ORDER BY j.branch_id, j.cashier_id, j.journal_date, j.id;

-- =================================================================
-- خطوة 4: قاعدة التنظيف الموصى بها
-- =================================================================
-- لكل مجموعة مكررة، احتفظ بالسجل ذو الأولوية الأعلى واحذف الباقي:
--   1) الأولوية القصوى: السجل المرتبط بإقفال يومي (closure link)
--   2) ثم: السجل بحالة approved → posted → submitted → draft
--   3) ثم: الأحدث تعديلاً (updated_at الأعلى)
--   4) كسر التعادل: id الأعلى
--
-- ⚠️ تحذير: تأكد من خطوة 3 أن السجل المُختار للحذف ليس مربوطاً بإقفال.
-- إذا كان مربوطاً، يجب إلغاء الإقفال أو دمج البيانات يدوياً.

-- معاينة (DRY-RUN): يعرض السجلات التي سيتم حذفها بدون حذف فعلي
WITH ranked AS (
  SELECT
    j.id,
    j.branch_id,
    j.cashier_id,
    j.journal_date,
    COALESCE(j.shift_type, '') AS shift_type,
    j.status,
    j.total_sales,
    j.updated_at,
    EXISTS (SELECT 1 FROM branch_daily_closure_journals bdcj WHERE bdcj.journal_id = j.id) AS in_closure,
    ROW_NUMBER() OVER (
      PARTITION BY j.branch_id, j.cashier_id, j.journal_date, COALESCE(j.shift_type, '')
      ORDER BY
        EXISTS (SELECT 1 FROM branch_daily_closure_journals bdcj WHERE bdcj.journal_id = j.id) DESC,
        CASE j.status
          WHEN 'approved' THEN 1
          WHEN 'posted' THEN 2
          WHEN 'submitted' THEN 3
          WHEN 'draft' THEN 4
          ELSE 5
        END,
        j.updated_at DESC NULLS LAST,
        j.id DESC
    ) AS rn
  FROM cashier_sales_journals j
)
SELECT id, branch_id, cashier_id, journal_date, shift_type, status,
       total_sales, in_closure, 'WILL BE DELETED' AS action
FROM ranked
WHERE rn > 1
ORDER BY branch_id, journal_date, cashier_id, id;

-- =================================================================
-- خطوة 5: الحذف الفعلي (شغّل هذا فقط بعد التأكد من خطوة 4)
-- =================================================================
-- ⚠️ ابدأ بمعاملة (BEGIN) واستخدم ROLLBACK إذا كانت النتيجة غير متوقعة
-- BEGIN;
--
-- WITH ranked AS (
--   SELECT
--     j.id,
--     ROW_NUMBER() OVER (
--       PARTITION BY j.branch_id, j.cashier_id, j.journal_date, COALESCE(j.shift_type, '')
--       ORDER BY
--         EXISTS (SELECT 1 FROM branch_daily_closure_journals bdcj WHERE bdcj.journal_id = j.id) DESC,
--         CASE j.status
--           WHEN 'approved' THEN 1 WHEN 'posted' THEN 2
--           WHEN 'submitted' THEN 3 WHEN 'draft' THEN 4 ELSE 5
--         END,
--         j.updated_at DESC NULLS LAST,
--         j.id DESC
--     ) AS rn
--   FROM cashier_sales_journals j
-- )
-- DELETE FROM cashier_sales_journals
-- WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
--
-- -- تحقق من العدد المحذوف ثم نفّذ COMMIT أو ROLLBACK
-- -- COMMIT;
-- -- ROLLBACK;

-- =================================================================
-- خطوة 6: إعادة تشغيل خطوة 1 للتأكد من اختفاء المكررات (يجب أن تعيد 0 صف)
-- =================================================================
-- ثم شغّل الآن: migrations/add_cashier_journal_integrity_constraints.sql
