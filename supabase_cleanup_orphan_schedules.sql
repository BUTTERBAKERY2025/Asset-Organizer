-- ============================================================================
-- تنظيف صفوف الدوام اليتيمة المكررة (تشير لموظفين محذوفين) — فرع الرياض
-- المشكلة: ظهور نفس الموظف مرتين في صفحة تسجيل الحضور (صف مكتمل + صف لم يحضر).
-- السبب: صفوف دوام قديمة تستخدم branch_emp_<id> لملفات اتحذفت، بجنب الملف الحقيقي.
--
-- الخريطة (الملف المحذوف -> الملف الحقيقي الموجود):
--   251 جو سيدي كانتيلا   -> 272 Josedy Sabanal
--   253 شيلو بيلا داكاني  -> 271 Chelo Dacanay
--   252 كليمينتي جونيور   -> 266 Clemente Sr Carnable
--   254 مار جوري جيراف    -> 273 Marjorie Langit Ojeras Raña
-- (محمد عياش / 257 غير مشمول — ما لقينا له بديل حقيقي.)
--
-- الأمان: يحذف صفاً يتيماً فقط لو الملف الحقيقي المقابل عنده دوام نفس اليوم/الوردية
--         => الموظف يظل يظهر مرة وحدة، بدون فقدان أي بيانات حقيقية. idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- الخطوة 1: معاينة (قراءة فقط) — شوف بالضبط أيّ صفوف بتنحذف قبل التنفيذ.
-- ----------------------------------------------------------------------------
WITH mapping(old_be, real_be) AS (
  VALUES (251,272),(253,271),(252,266),(254,273)
),
orphan AS (
  SELECT s.id AS schedule_id, s.branch_id, s.schedule_date, s.shift_type,
         s.employee_id, s.employee_name,
         COALESCE(s.branch_employee_id,
           CAST(substring(s.employee_id from '^branch_emp_([0-9]+)$') AS integer)) AS old_be
  FROM employee_schedules s
  WHERE s.is_off = false AND s.status = 'scheduled'
    AND s.schedule_date::date >= CURRENT_DATE
    AND NOT EXISTS (SELECT 1 FROM branch_employees be
        WHERE be.id = COALESCE(s.branch_employee_id,
                CAST(substring(s.employee_id from '^branch_emp_([0-9]+)$') AS integer))
           OR be.linked_user_id = s.employee_id)
)
SELECT o.schedule_id, o.branch_id, o.schedule_date, o.shift_type,
       o.employee_id, o.employee_name, o.old_be, m.real_be
FROM orphan o
JOIN mapping m ON m.old_be = o.old_be
WHERE EXISTS (
  SELECT 1 FROM employee_schedules v
  WHERE v.branch_id = o.branch_id
    AND v.schedule_date = o.schedule_date
    AND v.shift_type = o.shift_type
    AND v.is_off = false AND v.status = 'scheduled'
    AND ( v.branch_employee_id = m.real_be
       OR v.employee_id = 'branch_emp_' || m.real_be
       OR v.employee_id = (SELECT linked_user_id FROM branch_employees WHERE id = m.real_be) )
)
ORDER BY o.schedule_date, o.shift_type, o.employee_name;


-- ----------------------------------------------------------------------------
-- الخطوة 2: التنفيذ — احذف الصفوف اليتيمة المكررة (داخل معاملة آمنة).
--           نفّذها بعد ما تتأكد من نتيجة المعاينة في الخطوة 1.
-- ----------------------------------------------------------------------------
BEGIN;

WITH mapping(old_be, real_be) AS (
  VALUES (251,272),(253,271),(252,266),(254,273)
),
orphan AS (
  SELECT s.id AS schedule_id, s.branch_id, s.schedule_date, s.shift_type,
         COALESCE(s.branch_employee_id,
           CAST(substring(s.employee_id from '^branch_emp_([0-9]+)$') AS integer)) AS old_be
  FROM employee_schedules s
  WHERE s.is_off = false AND s.status = 'scheduled'
    AND s.schedule_date::date >= CURRENT_DATE
    AND NOT EXISTS (SELECT 1 FROM branch_employees be
        WHERE be.id = COALESCE(s.branch_employee_id,
                CAST(substring(s.employee_id from '^branch_emp_([0-9]+)$') AS integer))
           OR be.linked_user_id = s.employee_id)
),
to_delete AS (
  SELECT o.schedule_id
  FROM orphan o
  JOIN mapping m ON m.old_be = o.old_be
  WHERE EXISTS (
    SELECT 1 FROM employee_schedules v
    WHERE v.branch_id = o.branch_id
      AND v.schedule_date = o.schedule_date
      AND v.shift_type = o.shift_type
      AND v.is_off = false AND v.status = 'scheduled'
      AND ( v.branch_employee_id = m.real_be
         OR v.employee_id = 'branch_emp_' || m.real_be
         OR v.employee_id = (SELECT linked_user_id FROM branch_employees WHERE id = m.real_be) )
  )
)
DELETE FROM employee_schedules WHERE id IN (SELECT schedule_id FROM to_delete);

-- لو العدد المحذوف منطقي (4 لليوم الحالي + أي أيام قادمة لها بديل)، أكمل:
COMMIT;
-- لو شفت شي غلط، نفّذ بدلها: ROLLBACK;
