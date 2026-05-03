-- ============================================================
-- المرحلة 5: BOQ المحسّن + التكامل المحاسبي التلقائي
-- Phase 5: Enhanced BOQ + Auto Accounting Integration
-- ============================================================
-- نفّذ هذا في Supabase SQL Editor قبل نشر الكود على Render
-- ============================================================

-- 1) تحسين بنود العقد (BOQ): ترقيم هرمي + هيكلية أقسام
ALTER TABLE contract_items
  ADD COLUMN IF NOT EXISTS item_number TEXT,                              -- 1, 1.1, 1.2.1
  ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES contract_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_section BOOLEAN DEFAULT false,              -- صف عنوان قسم وليس بند
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_contract_items_parent ON contract_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_contract_items_contract_sort ON contract_items(contract_id, sort_order);

-- 2) ربط القيود المحاسبية بالعقود (للتكامل التلقائي)
ALTER TABLE accounting_journal_entries
  ADD COLUMN IF NOT EXISTS construction_contract_id INTEGER REFERENCES construction_contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entry_contract ON accounting_journal_entries(construction_contract_id);

-- ✅ تم.
