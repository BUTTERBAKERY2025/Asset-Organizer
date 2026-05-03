-- ============================================================
-- المرحلة 2: احتجاز الضمان + التحديث التلقائي للمراحل
-- Phase 2: Retention (Warranty Hold) + Auto Milestone Status
-- ============================================================
-- نفّذ هذا في Supabase SQL Editor قبل نشر الكود على Render
-- ============================================================

-- 1) إضافة حقول الاحتجاز للعقود
ALTER TABLE construction_contracts
  ADD COLUMN IF NOT EXISTS retention_percentage REAL DEFAULT 0,        -- نسبة الاحتجاز من كل دفعة (مثلاً 5 أو 10)
  ADD COLUMN IF NOT EXISTS retention_release_date TEXT,                 -- تاريخ الإفراج المتوقع عن الضمان
  ADD COLUMN IF NOT EXISTS retention_released BOOLEAN DEFAULT false,    -- هل تم الإفراج عن الضمان كاملاً؟
  ADD COLUMN IF NOT EXISTS retention_released_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS retention_released_by VARCHAR REFERENCES users(id);

-- 2) جدول حركات الاحتجاز (سجل تدقيقي لكل عملية احتجاز/إفراج)
CREATE TABLE IF NOT EXISTS contract_retentions (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES construction_contracts(id) ON DELETE CASCADE,
  milestone_id INTEGER REFERENCES contract_milestones(id) ON DELETE SET NULL,
  payment_request_id INTEGER REFERENCES payment_requests(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'hold',                  -- 'hold' (احتجاز عند الصرف) | 'release' (إفراج)
  amount REAL NOT NULL,                                -- المبلغ بالموجب دائماً
  percentage REAL,                                     -- النسبة المطبقة وقت الحركة (للتدقيق)
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contract_retentions_contract ON contract_retentions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_retentions_milestone ON contract_retentions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_contract_retentions_type ON contract_retentions(type);

-- ✅ تم. شغّل الكود على Render بعد ذلك.
