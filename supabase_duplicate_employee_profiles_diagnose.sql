-- ============================================================================
-- تشخيص: ملفات موظفين مكررة لنفس الشخص (branch_employees)
-- ----------------------------------------------------------------------------
-- العَرَض: في صفحة تسجيل الحضور/الانصراف يظهر نفس الموظف مرتين (مثلاً واحد
-- "مكتمل" وواحد "لم يحضر") — مثل "Clemente Sr Carnable Carnable" و"جو سيدي كانتيلا".
-- السبب: وجود ملفّين موظف منفصلين لنفس الشخص (غالباً واحد بالاسم الإنجليزي
-- وواحد بالعربي)، كل ملف له جدول، فيطلع صفّين في القائمة.
--
-- هذا الملف **قراءة فقط** (تشخيص) — لا يعدّل أي بيانات.
-- شغّل Q1 و Q2 وأرسل النتائج. بعد تحديد الملفّات المكررة، نعطيك سكربت دمج آمن.
-- ============================================================================


-- ============================================================================
-- Q1) ملفات مكررة بمعرّف قوي مشترك (رقم إقامة / جواز / رقم وظيفي / جوال)
--     داخل نفس الفرع — هذا أدق دليل على أنهم نفس الشخص.
-- ============================================================================
SELECT key_type, key_val, branch_id,
       array_agg(id ORDER BY id)            AS profile_ids,
       array_agg(employee_name ORDER BY id) AS names,
       array_agg(status ORDER BY id)        AS statuses
FROM (
  SELECT id, branch_id, employee_name, status, 'iqama'    AS key_type, NULLIF(btrim(iqama_number),'')    AS key_val FROM branch_employees
  UNION ALL SELECT id, branch_id, employee_name, status, 'passport', NULLIF(btrim(passport_number),'')  FROM branch_employees
  UNION ALL SELECT id, branch_id, employee_name, status, 'emp_no',   NULLIF(btrim(employee_number),'')  FROM branch_employees
  UNION ALL SELECT id, branch_id, employee_name, status, 'phone',    NULLIF(btrim(phone_number),'')     FROM branch_employees
) t
WHERE key_val IS NOT NULL
GROUP BY key_type, key_val, branch_id
HAVING COUNT(*) > 1
ORDER BY key_type, key_val;


-- ============================================================================
-- Q2) ملفات مكررة بتطابق الاسم (عربي = عربي، أو عربي يطابق الإنجليزي)
--     داخل نفس الفرع. مفيد لما تكون المعرّفات القوية فاضية.
-- ملاحظة: راجع كل زوج يدوياً — قد يتشابه شخصان مختلفان بالاسم.
-- ============================================================================
WITH n AS (
  SELECT id, branch_id, status, employee_name,
         regexp_replace(lower(btrim(employee_name)), '\s+',' ','g')                    AS na,
         regexp_replace(lower(btrim(coalesce(employee_name_en,''))), '\s+',' ','g')    AS ne
  FROM branch_employees
)
SELECT a.branch_id,
       a.id AS id1, a.employee_name AS name1, a.status AS st1,
       b.id AS id2, b.employee_name AS name2, b.status AS st2
FROM n a
JOIN n b
  ON a.branch_id = b.branch_id
 AND a.id < b.id
 AND ( a.na = b.na
    OR (a.ne <> '' AND a.ne = b.ne)
    OR (a.ne <> '' AND a.na = b.ne)
    OR (b.ne <> '' AND a.ne = b.na) )
ORDER BY a.branch_id, a.id;


-- ============================================================================
-- Q3) (اختياري) تفاصيل استخدام كل ملف لتحديد "الملف الأساسي" vs "المكرر":
--     عدّل القائمة (1,2,3) بأرقام الملفات اللي طلعت في Q1/Q2.
--     يعرض: عدد الجداول، عدد سجلات الحضور، الربط بحساب مستخدم، تاريخ الإنشاء.
-- ============================================================================
SELECT be.id, be.employee_name, be.employee_name_en, be.status, be.branch_id,
       be.linked_user_id,
       be.iqama_number, be.phone_number, be.employee_number,
       be.created_at,
       (SELECT COUNT(*) FROM employee_schedules s
         WHERE s.branch_employee_id = be.id
            OR s.employee_id = 'branch_emp_' || be.id)                 AS schedules_count,
       (SELECT COUNT(*) FROM attendance_records ar
         WHERE ar.branch_employee_id = be.id
            OR ar.employee_id = 'branch_emp_' || be.id
            OR ar.employee_id = be.linked_user_id)                     AS attendance_count
FROM branch_employees be
WHERE be.id IN (1, 2, 3)   -- <<< بدّلها بأرقام الملفات المكررة من Q1/Q2
ORDER BY be.id;
