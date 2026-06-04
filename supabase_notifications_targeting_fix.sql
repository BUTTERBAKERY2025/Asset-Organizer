-- ============================================================================
-- إصلاح: الرسائل/الإشعارات الموجّهة لمنصب أو مدير في فرع معيّن
-- كانت تصل لكل موظفي الفرع بدلاً من المستهدفين فقط.
--
-- السبب: قاعدة بيانات الإنتاج (Supabase) ينقصها عمود target_user_ids
-- (وأعمدة استهداف أخرى)، فلا يستطيع الكود تخزين قائمة المستلمين الدقيقة،
-- فيرجع للاستهداف القديم (الفرع + الدور) = كل الموظفين.
--
-- شغّل هذا الملف في Supabase SQL Editor *قبل* نشر الكود الجديد على Render.
-- الأوامر آمنة وقابلة للتكرار (IF NOT EXISTS) ولا تحذف أي بيانات.
-- ============================================================================

-- 1) أعمدة الاستهداف الدقيق (الأهم لهذه المشكلة)
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS target_user_ids text[];
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS target_role_ids text[];
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS target_branch_ids text[];
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS target_all_branches boolean NOT NULL DEFAULT true;

-- 2) أعمدة قد تكون ناقصة أيضاً (تمنع تعطّل جلب الإشعارات بالكامل)
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS auto_source text;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS effect_type text;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS emoji text;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS button_text text;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS button_action text;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS custom_sound_url text;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS sound_type text DEFAULT 'default';
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS background_color text DEFAULT '#ffffff';
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS text_color text DEFAULT '#1a1a1a';
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#d4a017';
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS animation_type text DEFAULT 'fade';
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS design_config jsonb;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS auto_close_seconds integer;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS show_once boolean NOT NULL DEFAULT false;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS display_time_start text;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS display_time_end text;

-- 3) (اختياري) إيقاف الرسائل القديمة العامة العالقة التي تظهر لكل الموظفين.
--    هذه رسائل أُنشئت بالكود القديم بدون استهداف دقيق. تأكّد من الناتج قبل التنفيذ.
--    لمعاينة ما سيتم إيقافه:
--      SELECT id, title, created_at FROM system_notifications
--      WHERE is_active = true
--        AND (target_user_ids IS NULL OR cardinality(target_user_ids) = 0)
--        AND title = 'رسالة من الإدارة';
--    ثم لإيقافها (أزل علامة التعليق):
-- UPDATE system_notifications
--   SET is_active = false
--   WHERE is_active = true
--     AND (target_user_ids IS NULL OR cardinality(target_user_ids) = 0)
--     AND title = 'رسالة من الإدارة';

-- 4) تحقق من نجاح الإضافة
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'system_notifications'
  AND column_name IN ('target_user_ids', 'target_role_ids', 'target_branch_ids', 'target_all_branches')
ORDER BY column_name;
