-- تحديث بيانات موظفي فرع المدينة المنورة
-- تاريخ التحديث: 2026-01-06

-- إضافة عمود رقم الموظف
ALTER TABLE branch_employees ADD COLUMN IF NOT EXISTS employee_number TEXT;

-- تحديث الموظفين السعوديين مع الأسماء الكاملة وتفاصيل الراتب

UPDATE branch_employees SET 
  employee_name = 'ايمان علي حسن حامضي',
  salary = 3500,
  housing_allowance = 500,
  transport_allowance = 0,
  other_allowances = 0,
  total_salary = 4000,
  employee_number = 'MED-00001'
WHERE id = 9;

UPDATE branch_employees SET 
  employee_name = 'سلطان محسن سالم المحضاري',
  salary = 3500,
  housing_allowance = 500,
  transport_allowance = 500,
  other_allowances = 1000,
  total_salary = 5500,
  employee_number = 'MED-00002'
WHERE id = 27;

UPDATE branch_employees SET 
  employee_name = 'وفا ايمن حسن قادري',
  salary = 3500,
  housing_allowance = 500,
  transport_allowance = 500,
  other_allowances = 0,
  total_salary = 4500,
  employee_number = 'MED-00003'
WHERE id = 11;

UPDATE branch_employees SET 
  employee_name = 'عمرو علي محمد سعيد عبدالشكور',
  salary = 3500,
  housing_allowance = 500,
  transport_allowance = 500,
  other_allowances = 0,
  total_salary = 4500,
  employee_number = 'MED-00004'
WHERE id = 10;

UPDATE branch_employees SET 
  employee_name = 'فارس علي المزيني',
  salary = 3500,
  housing_allowance = 500,
  transport_allowance = 500,
  total_salary = 4500,
  employee_number = 'MED-00005'
WHERE id = 14;

UPDATE branch_employees SET 
  employee_name = 'حسين جعفر',
  salary = 3500,
  housing_allowance = 500,
  transport_allowance = 500,
  total_salary = 4500,
  employee_number = 'MED-00006'
WHERE id = 28;

UPDATE branch_employees SET 
  employee_name = 'حنين محمد الردادي',
  salary = 3500,
  housing_allowance = 500,
  transport_allowance = 500,
  total_salary = 4500,
  employee_number = 'MED-00007'
WHERE id = 12;

UPDATE branch_employees SET 
  employee_name = 'طيف عبدالله سالم العنزي',
  salary = 3500,
  housing_allowance = 500,
  transport_allowance = 500,
  total_salary = 4500,
  employee_number = 'MED-00008'
WHERE id = 13;

-- تحديث الموظفين الأجانب

UPDATE branch_employees SET 
  employee_name = 'سوجيل',
  salary = 1200,
  total_salary = 1200,
  employee_number = 'MED-00009'
WHERE id = 26;

UPDATE branch_employees SET 
  employee_name = 'مد ياسين ميضي محمد تافازال',
  nationality = 'بنجلاديشي',
  salary = 2000,
  total_salary = 2000,
  employee_number = 'MED-00010'
WHERE id = 15;

UPDATE branch_employees SET 
  employee_name = 'مد شابوز خان',
  salary = 1200,
  total_salary = 1200,
  employee_number = 'MED-00011'
WHERE id = 34;

UPDATE branch_employees SET 
  employee_number = 'MED-00012'
WHERE id = 40;

UPDATE branch_employees SET 
  employee_name = 'خالد محمد علي قباني',
  salary = 3200,
  total_salary = 3200,
  employee_number = 'MED-00013'
WHERE id = 16;

UPDATE branch_employees SET 
  employee_name = 'اسماعيل محمد احمد محمود',
  salary = 3000,
  housing_allowance = 500,
  total_salary = 3500,
  employee_number = 'MED-00014'
WHERE id = 17;

UPDATE branch_employees SET employee_number = 'MED-00015' WHERE id = 18;

UPDATE branch_employees SET 
  employee_name = 'ارجون تهابا',
  salary = 1100,
  other_allowances = 200,
  total_salary = 1300,
  employee_number = 'MED-00016'
WHERE id = 19;

UPDATE branch_employees SET 
  employee_name = 'جيبان بدها',
  salary = 1100,
  other_allowances = 200,
  total_salary = 1300,
  employee_number = 'MED-00017'
WHERE id = 20;

UPDATE branch_employees SET 
  employee_name = 'راجو قوتام',
  salary = 1100,
  other_allowances = 200,
  total_salary = 1300,
  employee_number = 'MED-00018'
WHERE id = 21;

UPDATE branch_employees SET 
  employee_name = 'محمد نور الدين احمد',
  salary = 2800,
  total_salary = 2800,
  employee_number = 'MED-00019'
WHERE id = 22;

UPDATE branch_employees SET 
  employee_name = 'عبد الرحمن',
  salary = 2500,
  total_salary = 2500,
  employee_number = 'MED-00020'
WHERE id = 23;

UPDATE branch_employees SET employee_number = 'MED-00021' WHERE id = 24;
UPDATE branch_employees SET employee_number = 'MED-00022' WHERE id = 25;
UPDATE branch_employees SET employee_number = 'MED-00023' WHERE id = 29;
UPDATE branch_employees SET employee_number = 'MED-00024' WHERE id = 30;
UPDATE branch_employees SET employee_number = 'MED-00025' WHERE id = 31;
UPDATE branch_employees SET employee_number = 'MED-00026' WHERE id = 32;
UPDATE branch_employees SET employee_number = 'MED-00027' WHERE id = 33;
UPDATE branch_employees SET employee_number = 'MED-00028' WHERE id = 35;
UPDATE branch_employees SET employee_number = 'MED-00029' WHERE id = 36;
UPDATE branch_employees SET employee_number = 'MED-00030' WHERE id = 37;
UPDATE branch_employees SET employee_number = 'MED-00031' WHERE id = 38;
UPDATE branch_employees SET employee_number = 'MED-00032' WHERE id = 39;

UPDATE branch_employees SET 
  employee_name = 'احمد أسامة السيد البدراوي',
  salary = 3000,
  housing_allowance = 500,
  total_salary = 3500,
  employee_number = 'MED-00033'
WHERE id = 41;

-- إضافة موظف جديد
INSERT INTO branch_employees (
  branch_id, employee_number, employee_name, nationality, job_title, department,
  salary, housing_allowance, transport_allowance, other_allowances, total_salary, status
) VALUES (
  'medina', 'MED-00034', 'هاريدو مياه ريدوي', 'بنجلاديشي', 'عامل', 'عام',
  1000, 0, 0, 200, 1200, 'active'
);
