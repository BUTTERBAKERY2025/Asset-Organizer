-- =============================================================================
-- Production Migration: Journal Attachments → Supabase Storage
-- =============================================================================
-- شغّل هذا السكريبت في Supabase SQL Editor قبل نشر الكود الجديد على Render.
--
-- Run this in the Supabase SQL Editor BEFORE deploying the new code to Render.
--
-- ما يفعله السكريبت / What it does:
--   1. يضيف عمودين جديدين: file_path, download_url
--   2. يجعل عمود file_data اختيارياً (Nullable) للسجلات الجديدة
--   3. السجلات القديمة (Base64) تبقى كما هي وتعمل بشكل طبيعي
--
-- آمن للتشغيل أكثر من مرة (idempotent) — IF NOT EXISTS guards.
-- =============================================================================

ALTER TABLE journal_attachments
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS download_url TEXT;

ALTER TABLE journal_attachments
  ALTER COLUMN file_data DROP NOT NULL;

-- فهرس لتسريع جلب المرفقات لكل يومية (تحسين أداء كبير)
-- Index to speed up attachment lookups per journal (significant perf win)
CREATE INDEX IF NOT EXISTS idx_journal_attachments_journal_id
  ON journal_attachments(journal_id);

-- التحقق / Verification (يجب أن يظهر 3 صفوف بـ is_nullable=YES):
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'journal_attachments'
  AND column_name IN ('file_data', 'file_path', 'download_url')
ORDER BY column_name;

-- =============================================================================
-- بعد نشر الكود على Render وتسجيل دخول كمدير، نفّذ الترحيل من خلال:
-- After deploying code, log in as admin and call:
--   POST /api/admin/migrate-journal-attachments-to-supabase
--
-- مثال curl / Example curl (استبدل YOUR_DOMAIN و COOKIE):
-- curl -X POST https://YOUR_DOMAIN.com/api/admin/migrate-journal-attachments-to-supabase \
--      -H "Cookie: <admin-session-cookie>"
--
-- يعود برد JSON بهذا الشكل:
-- { "total": 42, "migrated": 42, "failed": 0, "errors": [] }
-- =============================================================================
