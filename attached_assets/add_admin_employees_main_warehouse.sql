WITH base AS (
    SELECT COALESCE(MAX(CAST(substring(employee_number from '([0-9]+)$') AS int)), 0) AS max_num
    FROM branch_employees WHERE branch_id = 'main_warehouse'
  ),
  data(rn, name, nat, sal, housing, transport, other, ins, bank) AS (
    VALUES
    (1, 'اروى احمد حسن عسيرى', 'سعودي', 5500, 500, 500, 0, 585, 'SA6080000461608010218909'),
  (2, 'حليمة مسفر الشريف القحطاني', 'سعودي', 4500, 500, 1000, 0, 488, 'SA46800003316080102533888'),
  (3, 'روابي فرحان عسيري', 'سعودي', 7000, 0, 0, 0, 0, 'SA1080000209608011057394'),
  (4, 'عبدالعزيز سعيد الهاجري', 'سعودي', 4000, 0, 0, 0, 0, 'SA4610000088200001188607'),
  (5, 'محمد عميد سليمان فايع', 'سعودي', 3500, 500, 0, 0, 0, ''),
  (6, 'شهد منصور القحطاني', 'سعودي', 3500, 1000, 500, 0, 0, 'SA5480000347608010939413'),
  (7, 'وفاء احمد على ال مفرح', 'سعودي', 4000, 500, 500, 0, 439, 'SA2780000209608011430732'),
  (8, 'ريما محمد عبدالرحمن المرزوق', 'سعودي', 3500, 500, 0, 0, 390, 'SA6880000539608018643486'),
  (9, 'محمد احمد ايوب الخليفه', 'سوداني', 3500, 0, 500, 0, 0, 'SA8280000543608016028593'),
  (10, 'أحمد محمد حسن زيده', 'مصري', 5000, 1200, 600, 0, 0, 'SA4380000991608016176548'),
  (11, 'سعيد عوض المعاري', 'يمني', 4500, 1000, 500, 0, 0, 'SA2180000378608010217747'),
  (12, 'محمد نيليو اوسين شيمول', 'بنجلاديش', 1200, 0, 0, 500, 0, '')
  ),
  filtered AS (
    SELECT d.*, ROW_NUMBER() OVER (ORDER BY d.rn) AS seq
    FROM data d
    WHERE NOT EXISTS (
      SELECT 1 FROM branch_employees be
      WHERE be.branch_id = 'main_warehouse' AND be.employee_name = d.name
    )
  )
  INSERT INTO branch_employees (
    branch_id, employee_name, job_title, nationality, salary,
    housing_allowance, transport_allowance, food_allowance, other_allowances,
    social_insurance_deduction, total_salary, bank_account_number,
    employee_number, status, contract_type, status_changed_at, created_at, updated_at
  )
  SELECT 'main_warehouse', f.name, 'موظف إداري', f.nat, f.sal,
    f.housing, f.transport, 0, f.other,
    CASE WHEN f.nat = 'سعودي' THEN f.ins ELSE 0 END,
    (f.sal + f.housing + f.transport + 0 + f.other) - (CASE WHEN f.nat = 'سعودي' THEN f.ins ELSE 0 END),
    NULLIF(f.bank, ''),
    'MAI-' || LPAD(((SELECT max_num FROM base) + f.seq)::text, 5, '0'),
    'active', 'full_time', now(), now(), now()
  FROM filtered f;
