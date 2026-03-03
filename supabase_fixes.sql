-- ===== استعلامات إصلاح قاعدة البيانات الإنتاجية (Supabase) =====
-- قم بتشغيل هذه الاستعلامات في Supabase SQL Editor واحداً تلو الآخر
-- تاريخ الإنشاء: 2026-03-03

-- =============================================
-- 1. إضافة حماية ضد الحضور المزدوج لنفس الموظف في نفس اليوم
-- =============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_attendance_per_employee_date 
ON attendance_records (employee_id, attendance_date);

-- =============================================
-- 2. إضافة حماية ضد تكرار الورديات لنفس الفرع
-- =============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_shift_profile_per_branch 
ON branch_shift_profiles (branch_id, shift_code);

-- =============================================
-- 3. حذف الفهارس المكررة (توفير مساحة)
-- =============================================
DROP INDEX IF EXISTS idx_attendance_records_branch;
DROP INDEX IF EXISTS idx_attendance_records_date;

-- =============================================
-- 4. تحديث أيام الإجازة بدون نوع وردية
-- =============================================
UPDATE employee_schedules 
SET shift_type = 'off' 
WHERE shift_type IS NULL AND is_off = true;

-- =============================================
-- 5. إنشاء إعدادات الورديات الافتراضية لجميع الفروع التي لا تملكها
-- هذا الاستعلام ذكي - يتحقق من كل فرع ويضيف فقط الورديات المفقودة
-- =============================================
INSERT INTO branch_shift_profiles (branch_id, shift_code, display_name, start_time, end_time, break_minutes, grace_minutes_before, grace_minutes_after, is_active, sort_order)
SELECT b.id, v.shift_code, v.display_name, v.start_time, v.end_time, 60, 15, 15, true, v.sort_order
FROM branches b
CROSS JOIN (VALUES 
  ('morning', 'الوردية الصباحية', '06:00', '14:00', 1),
  ('evening', 'الوردية المسائية', '14:00', '22:00', 2),
  ('night', 'الوردية الليلية', '22:00', '06:00', 3)
) AS v(shift_code, display_name, start_time, end_time, sort_order)
LEFT JOIN branch_shift_profiles bsp ON b.id = bsp.branch_id AND v.shift_code = bsp.shift_code
WHERE bsp.id IS NULL;

-- =============================================
-- 6. فحص: التأكد من أن جميع الفروع لديها إعدادات ورديات
-- (هذا استعلام فحص فقط - لا يعدل شيء)
-- =============================================
SELECT b.id, b.name, COUNT(bsp.id) as profile_count
FROM branches b
LEFT JOIN branch_shift_profiles bsp ON b.id = bsp.branch_id
GROUP BY b.id, b.name
ORDER BY profile_count ASC;

-- =============================================
-- 7. فحص: التأكد من صحة أوقات الورديات لكل فرع
-- (هذا استعلام فحص فقط - لا يعدل شيء)
-- إذا وجدت أوقات غريبة، عدّلها من صفحة إعدادات الورديات
-- =============================================
SELECT branch_id, shift_code, display_name, start_time, end_time, is_active
FROM branch_shift_profiles
ORDER BY branch_id, sort_order;

-- =============================================
-- 8. فحص: جودة بيانات الجداول
-- (هذا استعلام فحص فقط - لا يعدل شيء)
-- =============================================
SELECT 
  shift_type, 
  COUNT(*) as total,
  COUNT(CASE WHEN branch_employee_id IS NULL THEN 1 END) as missing_branch_emp,
  COUNT(CASE WHEN start_time IS NULL AND is_off = false THEN 1 END) as missing_time
FROM employee_schedules
GROUP BY shift_type
ORDER BY total DESC;
