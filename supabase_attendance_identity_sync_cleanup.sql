-- ============================================================================
-- إصلاح تزامن الحضور/الانصراف بين بوابة الموظف (بوابتي) وصفحة الحضور المجمعة
-- Attendance identity sync cleanup
-- ----------------------------------------------------------------------------
-- المشكلة: بعض الموظفين سجلاتهم محفوظة بهويّات مختلفة (نص branch_emp_<n> /
-- رقم branch_employee_id / UUID لحساب المستخدم)، فيصير سجلين لنفس اليوم،
-- وتظهر بوابتي "في الدوام" رغم تسجيل الانصراف بالصفحة المجمعة.
--
-- ترتيب التنفيذ في Supabase SQL Editor:
--   1) STEP 0  : تشخيص (قراءة فقط — آمن) — شوف المتأثرين قبل أي تعديل.
--   2) STEP 1  : نسخة احتياطية (إلزامي قبل أي حذف).
--   3) STEP 2  : تعبئة branch_employee_id (إضافي وآمن).
--   4) STEP 3  : دمج السجلات المكررة لنفس الموظف ونفس اليوم (يحذف الزائد).
--   5) STEP 4  : تحقق نهائي (قراءة فقط).
--
-- ملاحظة: السكربت idempotent — تقدر تشغّله أكثر من مرة بأمان.
-- ============================================================================


-- ============================================================================
-- STEP 0 — تشخيص (قراءة فقط، لا يعدّل شيء)
-- ============================================================================

-- 0.a) سجلات بدون branch_employee_id لكن يمكن ربطها (الهويّة الناقصة):
SELECT 'missing_branch_employee_id' AS issue, COUNT(*) AS rows
FROM attendance_records ar
WHERE ar.branch_employee_id IS NULL
  AND (
    ar.employee_id ~ '^branch_emp_[0-9]+$'
    OR EXISTS (SELECT 1 FROM branch_employees be WHERE be.linked_user_id = ar.employee_id)
  );

-- 0.b) موظفون لهم أكثر من سجل في نفس اليوم (تكرار حقيقي = نفس الموظف):
-- يربط الهوية عبر 3 طرق: العمود الرقمي، صيغة branch_emp_<n>، و UUID المربوط
-- في branch_employees.linked_user_id. ويستبعد السجلات غير القابلة للربط حتى لا
-- تتجمّع تحت NULL وتظهر كأنها موظف واحد (وهي في الحقيقة موظفون مختلفون).
WITH resolved AS (
  SELECT
    ar.id, ar.attendance_date, ar.actual_check_in, ar.actual_check_out,
    COALESCE(
      ar.branch_employee_id,
      CAST(substring(ar.employee_id from '^branch_emp_([0-9]+)$') AS integer),
      be.id
    ) AS resolved_emp
  FROM attendance_records ar
  LEFT JOIN branch_employees be ON be.linked_user_id = ar.employee_id
)
SELECT
  resolved_emp,
  attendance_date,
  COUNT(*)                                                                          AS records,
  COUNT(*) FILTER (WHERE actual_check_in IS NOT NULL AND actual_check_out IS NULL)  AS open_records,
  string_agg(id::text || ':' || COALESCE(actual_check_in,'-') || '→' || COALESCE(actual_check_out,'-'), ', ' ORDER BY id) AS detail
FROM resolved
WHERE resolved_emp IS NOT NULL          -- تكرار حقيقي فقط (نفس الموظف)
GROUP BY resolved_emp, attendance_date
HAVING COUNT(*) > 1
ORDER BY attendance_date DESC, resolved_emp;

-- 0.c) سجلات غير قابلة للربط نهائياً (employee_id ليس branch_emp_<n> ولا UUID مربوط):
-- هذه لن تُدمج في STEP 3 (آمنة)، لكن من المفيد معرفتها — قد تكون حسابات قديمة غير مربوطة.
SELECT ar.id, ar.employee_id, ar.employee_name, ar.attendance_date,
       ar.actual_check_in, ar.actual_check_out
FROM attendance_records ar
LEFT JOIN branch_employees be ON be.linked_user_id = ar.employee_id
WHERE ar.branch_employee_id IS NULL
  AND ar.employee_id !~ '^branch_emp_[0-9]+$'
  AND be.id IS NULL
ORDER BY ar.attendance_date DESC, ar.id;


-- ============================================================================
-- STEP 1 — نسخة احتياطية (إلزامي قبل STEP 3) — يحفظ كل السجلات كما هي الآن
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_records_backup_sync AS
SELECT * FROM attendance_records;
-- لو شغّلت السكربت مرة ثانية والنسخة موجودة، حدّثها يدوياً فقط لو احتجت:
--   DROP TABLE attendance_records_backup_sync; ثم أعد تنفيذ STEP 1.


-- ============================================================================
-- STEP 2 — تعبئة branch_employee_id (إضافي وآمن، لا يحذف شيء)
-- يجعل العمود الرقمي هو المفتاح الموحّد لكل السجلات.
-- ============================================================================

-- 2.a) من الصيغة النصية branch_emp_<n>
UPDATE attendance_records
SET branch_employee_id = CAST(substring(employee_id from '^branch_emp_([0-9]+)$') AS integer)
WHERE branch_employee_id IS NULL
  AND employee_id ~ '^branch_emp_[0-9]+$';

-- 2.b) من UUID حساب المستخدم المربوط
UPDATE attendance_records ar
SET branch_employee_id = be.id
FROM branch_employees be
WHERE ar.branch_employee_id IS NULL
  AND ar.employee_id = be.linked_user_id;

-- ----------------------------------------------------------------------------
-- 2.c) ربط السجلات اليتيمة (UUID غير مربوط) بملف الموظف عبر الاسم
-- داخل نفس الفرع — وفقط عندما يكون الاسم غير مكرر (تطابق واحد فقط) تجنباً
-- لأي ربط خاطئ. هذا يعالج حالة مثل "محمد غلام طلعت" المسجّل تحت UUID يتيم.
-- ----------------------------------------------------------------------------

-- 2.c.1) معاينة (قراءة فقط) — راجعها قبل تنفيذ التحديث في 2.c.2
WITH att AS (
  SELECT ar.id AS att_id, ar.branch_id, ar.employee_name,
         regexp_replace(lower(btrim(ar.employee_name)), '\s+', ' ', 'g') AS nname
  FROM attendance_records ar
  LEFT JOIN branch_employees be ON be.linked_user_id = ar.employee_id
  WHERE ar.branch_employee_id IS NULL
    AND ar.employee_id !~ '^branch_emp_[0-9]+$'
    AND be.id IS NULL
)
SELECT a.att_id, a.employee_name,
       COUNT(b.id)        AS name_matches_in_branch,
       (array_agg(b.id))[1]            AS will_link_to_branch_employee_id,
       (array_agg(b.employee_name))[1] AS will_link_to_name,
       CASE WHEN COUNT(b.id) = 1 THEN 'سيُربط ✅'
            WHEN COUNT(b.id) = 0 THEN 'لا يوجد تطابق — يُترك كما هو'
            ELSE 'اسم مكرر — لن يُربط (راجع يدوياً)' END AS action
FROM att a
LEFT JOIN branch_employees b
  ON b.branch_id = a.branch_id
 AND regexp_replace(lower(btrim(b.employee_name)), '\s+', ' ', 'g') = a.nname
GROUP BY a.att_id, a.employee_name
ORDER BY a.employee_name;

-- 2.c.2) التنفيذ — يربط فقط الحالات ذات التطابق الواحد (الآمنة)
WITH att AS (
  SELECT ar.id AS att_id, ar.branch_id,
         regexp_replace(lower(btrim(ar.employee_name)), '\s+', ' ', 'g') AS nname
  FROM attendance_records ar
  LEFT JOIN branch_employees be ON be.linked_user_id = ar.employee_id
  WHERE ar.branch_employee_id IS NULL
    AND ar.employee_id !~ '^branch_emp_[0-9]+$'
    AND be.id IS NULL
),
matched AS (
  SELECT a.att_id, (array_agg(b.id))[1] AS be_id, COUNT(b.id) AS n
  FROM att a
  JOIN branch_employees b
    ON b.branch_id = a.branch_id
   AND regexp_replace(lower(btrim(b.employee_name)), '\s+', ' ', 'g') = a.nname
  GROUP BY a.att_id
)
UPDATE attendance_records ar
SET branch_employee_id = m.be_id, updated_at = NOW()
FROM matched m
WHERE ar.id = m.att_id
  AND m.n = 1;


-- ============================================================================
-- STEP 3 — دمج السجلات المكررة لنفس الموظف (branch_employee_id) ونفس اليوم
-- ----------------------------------------------------------------------------
-- المبدأ: نُبقي أقدم سجل (أصغر id) كـ"محتفظ به"، وندمج فيه:
--   - أبكر وقت حضور  (actual_check_in)
--   - آخر وقت انصراف (actual_check_out) + توقيعه
-- ثم نحذف السجلات الزائدة. (شغّل STEP 1 قبله!)
-- ============================================================================

-- 3.a) احسب القيم المدمجة لكل مجموعة (موظف + يوم) فيها أكثر من سجل
WITH grp AS (
  SELECT branch_employee_id, attendance_date
  FROM attendance_records
  WHERE branch_employee_id IS NOT NULL
  GROUP BY branch_employee_id, attendance_date
  HAVING COUNT(*) > 1
),
keeper AS (
  SELECT ar.branch_employee_id, ar.attendance_date, MIN(ar.id) AS keeper_id
  FROM attendance_records ar
  JOIN grp g USING (branch_employee_id, attendance_date)
  GROUP BY ar.branch_employee_id, ar.attendance_date
),
ci AS (  -- أبكر حضور
  SELECT branch_employee_id, attendance_date, MIN(actual_check_in) AS ci
  FROM attendance_records
  JOIN grp USING (branch_employee_id, attendance_date)
  WHERE actual_check_in IS NOT NULL
  GROUP BY branch_employee_id, attendance_date
),
co AS (  -- آخر انصراف + توقيعه (نختار صف الانصراف الأحدث)
  SELECT DISTINCT ON (branch_employee_id, attendance_date)
    branch_employee_id, attendance_date,
    actual_check_out AS co, check_out_signature AS co_sig
  FROM attendance_records
  JOIN grp USING (branch_employee_id, attendance_date)
  WHERE actual_check_out IS NOT NULL
  ORDER BY branch_employee_id, attendance_date, actual_check_out DESC, id DESC
)
UPDATE attendance_records t
SET
  actual_check_in     = COALESCE(ci.ci, t.actual_check_in),
  actual_check_out    = COALESCE(co.co, t.actual_check_out),
  check_out_signature = COALESCE(co.co_sig, t.check_out_signature),
  working_hours = CASE
    WHEN COALESCE(ci.ci, t.actual_check_in) IS NOT NULL
     AND COALESCE(co.co, t.actual_check_out) IS NOT NULL THEN
      ROUND((
        (EXTRACT(EPOCH FROM COALESCE(co.co, t.actual_check_out)::time)
         - EXTRACT(EPOCH FROM COALESCE(ci.ci, t.actual_check_in)::time)
         + CASE WHEN COALESCE(co.co, t.actual_check_out)::time
                   < COALESCE(ci.ci, t.actual_check_in)::time
                THEN 86400 ELSE 0 END) / 3600.0)::numeric, 2)
    ELSE t.working_hours
  END,
  updated_at = NOW()
FROM keeper k
LEFT JOIN ci USING (branch_employee_id, attendance_date)
LEFT JOIN co USING (branch_employee_id, attendance_date)
WHERE t.id = k.keeper_id
  AND k.branch_employee_id = t.branch_employee_id
  AND k.attendance_date = t.attendance_date;

-- 3.b) احذف السجلات الزائدة (كل شيء عدا المحتفظ به في كل مجموعة)
WITH grp AS (
  SELECT branch_employee_id, attendance_date
  FROM attendance_records
  WHERE branch_employee_id IS NOT NULL
  GROUP BY branch_employee_id, attendance_date
  HAVING COUNT(*) > 1
),
keeper AS (
  SELECT ar.branch_employee_id, ar.attendance_date, MIN(ar.id) AS keeper_id
  FROM attendance_records ar
  JOIN grp g USING (branch_employee_id, attendance_date)
  GROUP BY ar.branch_employee_id, ar.attendance_date
)
DELETE FROM attendance_records t
USING keeper k
WHERE t.branch_employee_id = k.branch_employee_id
  AND t.attendance_date   = k.attendance_date
  AND t.id <> k.keeper_id;


-- ============================================================================
-- STEP 4 — تحقق نهائي (قراءة فقط) — لازم يرجع صفر صفوف
-- ============================================================================
SELECT branch_employee_id, attendance_date, COUNT(*) AS still_duplicated
FROM attendance_records
WHERE branch_employee_id IS NOT NULL
GROUP BY branch_employee_id, attendance_date
HAVING COUNT(*) > 1;

-- بعد التأكد إن كل شي تمام لعدة أيام، تقدر تحذف النسخة الاحتياطية:
--   DROP TABLE attendance_records_backup_sync;
