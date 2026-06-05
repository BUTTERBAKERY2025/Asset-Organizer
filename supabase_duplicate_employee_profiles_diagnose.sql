-- ============================================================================
-- تشخيص: ظهور نفس الموظف مرتين في صفحة تسجيل الحضور/الانصراف
-- ----------------------------------------------------------------------------
-- في صفحة الحضور يظهر الموظف صفّين (واحد "مكتمل" وواحد "لم يحضر").
-- في الغالب لأحد سببين:
--   (أ) نفس الموظف له صفّان في جدول الدوام (employee_schedules) بهويّتين
--       مختلفتين: واحد canonical (branch_emp_<id>) وواحد قديم (UUID المستخدم).
--       دالة العرض تجمع على نص المعرّف فما تدمجهم → صفّان.
--   (ب) نفس الشخص له ملفّان منفصلان (branch_employees) — واحد إنجليزي وواحد عربي.
--
-- هذا الملف **قراءة فقط** (تشخيص) — لا يعدّل أي بيانات.
-- ابدأ بـ D0 (الأهم) — يعيد إنتاج الصفحة بالضبط ويكشف أي اسم متكرر تشوفه.
-- ============================================================================


-- ============================================================================
-- D0) الأهم: يعيد إنتاج قائمة الحضور ويجمع حسب الاسم الظاهر — يكشف أي موظف
--     يظهر أكثر من مرة (زي "جو سيدي كانتيلا") مهما كان سبب التكرار.
--     يفحص آخر 7 أيام تلقائياً (ما يحتاج تبديل تاريخ).
--     • لو be_ids كلها نفس الرقم (أو فيها NULL) = نفس الشخص بهويّتين  → يصلحه الكود.
--     • لو be_ids أرقام مختلفة = ملفّان موظف منفصلان              → يحتاج دمج.
-- ============================================================================
WITH sched AS (
  SELECT s.id AS schedule_id, s.branch_id, s.schedule_date,
         s.employee_id, s.branch_employee_id,
         COALESCE(
           s.branch_employee_id,
           CAST(substring(s.employee_id from '^branch_emp_([0-9]+)$') AS integer),
           bl.id
         ) AS be_id,
         COALESCE(be.employee_name, bl.employee_name, s.employee_name) AS resolved_name
  FROM employee_schedules s
  LEFT JOIN branch_employees bl ON bl.linked_user_id = s.employee_id
  LEFT JOIN branch_employees be ON be.id = COALESCE(
           s.branch_employee_id,
           CAST(substring(s.employee_id from '^branch_emp_([0-9]+)$') AS integer))
  WHERE s.is_off = false AND s.status = 'scheduled'
    AND s.schedule_date::date >= CURRENT_DATE - 7   -- آخر 7 أيام
)
SELECT branch_id, schedule_date, resolved_name,
       COUNT(*) AS rows,
       array_agg(schedule_id ORDER BY schedule_id) AS schedule_ids,
       array_agg(employee_id ORDER BY schedule_id) AS employee_ids,
       array_agg(be_id ORDER BY schedule_id)       AS be_ids
FROM sched
GROUP BY branch_id, schedule_date, resolved_name
HAVING COUNT(*) > 1
ORDER BY schedule_date DESC, branch_id, resolved_name;


-- ============================================================================
-- D0b) مثل D0 لكن يجمع حسب رقم الموظف (be_id) بدل الاسم — يكشف نفس الشخص
--      حتى لو اسمه مكتوب بصيغتين مختلفتين (إنجليزي/عربي). راجع عمود names:
--      لو فيه اسمان مختلفان لنفس be_id = نفس الشخص بصيغتي اسم (السبب أ).
--      يفحص آخر 7 أيام تلقائياً.
-- ============================================================================
WITH sched AS (
  SELECT s.id AS schedule_id, s.branch_id, s.schedule_date, s.employee_id,
         COALESCE(
           s.branch_employee_id,
           CAST(substring(s.employee_id from '^branch_emp_([0-9]+)$') AS integer),
           bl.id
         ) AS be_id,
         COALESCE(be.employee_name, bl.employee_name, s.employee_name) AS resolved_name
  FROM employee_schedules s
  LEFT JOIN branch_employees bl ON bl.linked_user_id = s.employee_id
  LEFT JOIN branch_employees be ON be.id = COALESCE(
           s.branch_employee_id,
           CAST(substring(s.employee_id from '^branch_emp_([0-9]+)$') AS integer))
  WHERE s.is_off = false AND s.status = 'scheduled'
    AND s.schedule_date::date >= CURRENT_DATE - 7
)
SELECT branch_id, schedule_date, be_id,
       COUNT(*) AS rows,
       array_agg(DISTINCT resolved_name)           AS names,
       array_agg(employee_id ORDER BY schedule_id) AS employee_ids
FROM sched
WHERE be_id IS NOT NULL
GROUP BY branch_id, schedule_date, be_id
HAVING COUNT(*) > 1
ORDER BY schedule_date DESC, branch_id, be_id;


-- ============================================================================
-- D1) السبب (أ): نفس الموظف (هوية موحّدة be_id) له أكثر من صف في الدوام
--     بمعرّفات employee_id مختلفة — هذا اللي يسبّب صفّين في صفحة الحضور.
--     يحلّ الهوية بـ 3 طرق: العمود الرقمي، صيغة branch_emp_<n>، و UUID المربوط.
-- >>> عدّل التاريخ لتاريخ اليوم اللي تشوف فيه التكرار في الصفحة <<<
-- ============================================================================
WITH sched AS (
  SELECT s.id AS schedule_id, s.branch_id, s.schedule_date, s.shift_type,
         s.employee_id, s.branch_employee_id, s.employee_name AS sched_name,
         COALESCE(
           s.branch_employee_id,
           CAST(substring(s.employee_id from '^branch_emp_([0-9]+)$') AS integer),
           be_link.id
         ) AS be_id
  FROM employee_schedules s
  LEFT JOIN branch_employees be_link ON be_link.linked_user_id = s.employee_id
  WHERE s.is_off = false
    AND s.status = 'scheduled'
    AND s.schedule_date = '2026-06-05'      -- <<< بدّل التاريخ هنا
)
SELECT branch_id, schedule_date, be_id,
       COUNT(*)                         AS roster_rows,
       array_agg(DISTINCT employee_id)  AS employee_ids,
       array_agg(DISTINCT sched_name)   AS sched_names
FROM sched
WHERE be_id IS NOT NULL
GROUP BY branch_id, schedule_date, be_id
HAVING COUNT(DISTINCT employee_id) > 1
ORDER BY branch_id, be_id;


-- ============================================================================
-- D1.x) صفوف دوام بهوية غير قابلة للحل (employee_id = UUID غير مربوط بأي ملف):
--       هذي قد تظهر باسم منفصل وتسبّب "لم يحضر". للعلم/المراجعة.
-- >>> نفس التاريخ <<<
-- ============================================================================
SELECT s.id AS schedule_id, s.branch_id, s.employee_id, s.employee_name, s.shift_type
FROM employee_schedules s
LEFT JOIN branch_employees be_link ON be_link.linked_user_id = s.employee_id
WHERE s.is_off = false AND s.status = 'scheduled'
  AND s.schedule_date = '2026-06-05'        -- <<< بدّل التاريخ هنا
  AND s.branch_employee_id IS NULL
  AND s.employee_id !~ '^branch_emp_[0-9]+$'
  AND be_link.id IS NULL
ORDER BY s.branch_id, s.employee_id;


-- ============================================================================
-- D2) السبب (ب): ملفّان موظف منفصلان لنفس الشخص بمعرّف قوي مشترك
--     (رقم إقامة / جواز / رقم وظيفي / جوال) داخل نفس الفرع — أدق دليل.
-- ============================================================================
WITH base AS (
  SELECT id, branch_id, employee_name, status, 'iqama'    AS key_type, btrim(iqama_number)    AS raw FROM branch_employees
  UNION ALL SELECT id, branch_id, employee_name, status, 'passport', btrim(passport_number)  FROM branch_employees
  UNION ALL SELECT id, branch_id, employee_name, status, 'emp_no',   btrim(employee_number)  FROM branch_employees
  UNION ALL SELECT id, branch_id, employee_name, status, 'phone',    btrim(phone_number)     FROM branch_employees
),
clean AS (
  SELECT id, branch_id, employee_name, status, key_type,
         -- للجوال: نأخذ الأرقام فقط (نتجاهل المسافات والشرطات)
         CASE WHEN key_type = 'phone' THEN NULLIF(regexp_replace(COALESCE(raw,''), '\D', '', 'g'), '')
              ELSE NULLIF(raw, '') END AS key_val
  FROM base
)
SELECT key_type, key_val, branch_id,
       array_agg(id ORDER BY id)            AS profile_ids,
       array_agg(employee_name ORDER BY id) AS names,
       array_agg(status ORDER BY id)        AS statuses
FROM clean
WHERE key_val IS NOT NULL
  -- تجاهل القيم الوهمية الشائعة
  AND lower(key_val) NOT IN ('--','-','—','na','n/a','none','null','لا يوجد','لايوجد','غير معروف','xxx','x')
  -- تجاهل أي قيمة كلها نفس الحرف/الرقم مكرر (مثل 0000 أو -----)
  AND key_val !~ '^(.)\1*$'
  -- حد أدنى للطول: الجوال 9+ أرقام، البقية 5+ خانات
  AND ( (key_type = 'phone' AND length(key_val) >= 9)
        OR (key_type <> 'phone' AND length(key_val) >= 5) )
GROUP BY key_type, key_val, branch_id
HAVING COUNT(*) > 1
ORDER BY key_type, key_val;


-- ============================================================================
-- D3) (اختياري) تفاصيل استخدام كل ملف لتحديد "الأساسي" vs "المكرر":
--     بدّل القائمة (1,2,3) بأرقام be_id من D1 أو profile_ids من D2.
-- ============================================================================
SELECT be.id, be.employee_name, be.employee_name_en, be.status, be.branch_id,
       be.linked_user_id, be.iqama_number, be.phone_number, be.employee_number,
       be.created_at,
       (SELECT COUNT(*) FROM employee_schedules s
         WHERE s.branch_employee_id = be.id
            OR s.employee_id = 'branch_emp_' || be.id
            OR s.employee_id = be.linked_user_id)                  AS schedules_count,
       (SELECT COUNT(*) FROM attendance_records ar
         WHERE ar.branch_employee_id = be.id
            OR ar.employee_id = 'branch_emp_' || be.id
            OR ar.employee_id = be.linked_user_id)                 AS attendance_count
FROM branch_employees be
WHERE be.id IN (1, 2, 3)   -- <<< بدّلها بأرقام الملفات من D1/D2
ORDER BY be.id;
