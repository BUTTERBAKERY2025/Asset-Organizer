-- ============================================================
-- المرحلة 6: نموذج العقد الرسمي القابل للطباعة
-- Phase 6: Official printable contract document
-- ============================================================
-- نفّذ هذا في Supabase SQL Editor قبل نشر الكود على Render
-- ============================================================

ALTER TABLE construction_contracts
  ADD COLUMN IF NOT EXISTS scope_of_work TEXT,                          -- تفاصيل ونطاق الأعمال (نص طويل)
  ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT,                   -- الشروط والأحكام التعاقدية
  ADD COLUMN IF NOT EXISTS execution_duration TEXT,                     -- مدة التنفيذ (مثلاً: 90 يوم)
  ADD COLUMN IF NOT EXISTS work_location TEXT,                          -- موقع تنفيذ الأعمال
  ADD COLUMN IF NOT EXISTS first_party_name TEXT,                       -- اسم الطرف الأول (الشركة)
  ADD COLUMN IF NOT EXISTS first_party_representative TEXT,             -- ممثل الطرف الأول
  ADD COLUMN IF NOT EXISTS first_party_title TEXT,                      -- منصبه
  ADD COLUMN IF NOT EXISTS first_party_id_number TEXT,                  -- السجل التجاري / الهوية
  ADD COLUMN IF NOT EXISTS signature_date TEXT,                         -- تاريخ التوقيع
  ADD COLUMN IF NOT EXISTS signature_location TEXT,                     -- مكان التوقيع
  ADD COLUMN IF NOT EXISTS contract_year INTEGER;                       -- سنة العقد للترقيم التلقائي

CREATE INDEX IF NOT EXISTS idx_construction_contracts_year ON construction_contracts(contract_year);

-- Backfill contract_year for existing rows from start_date or createdAt
UPDATE construction_contracts
SET contract_year = COALESCE(
  EXTRACT(YEAR FROM CAST(NULLIF(start_date, '') AS DATE))::INTEGER,
  EXTRACT(YEAR FROM created_at)::INTEGER
)
WHERE contract_year IS NULL;

-- ✅ تم.
