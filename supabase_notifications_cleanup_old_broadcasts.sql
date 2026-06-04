-- ============================================================================
-- تنظيف: إيقاف الرسائل العامة القديمة العالقة التي ما زالت تظهر لكل الموظفين.
--
-- هذه رسائل أُنشئت بالكود القديم (قبل إضافة عمود target_user_ids)، فهي مخزّنة
-- بدون استهداف دقيق وتظهر لكل موظفي الفرع. إضافة العمود تُصلح الرسائل الجديدة
-- فقط، أما الرسائل القديمة فيجب إيقافها يدوياً بهذا الملف.
--
-- شغّله في Supabase SQL Editor.
-- ملاحظة: لا يحذف أي بيانات — فقط يضع is_active = false (إخفاء من الجرس/النافذة).
-- يستثني رسائل المناسبات التلقائية (مثل ذكرى الالتحاق) فهي مقصودة لكل الفرع.
-- ============================================================================

-- 1) معاينة الرسائل التي سيتم إيقافها (شغّلها أولاً لتتأكد):
SELECT id, title, message_type, target_branch_ids, is_active, created_at
FROM system_notifications
WHERE is_active = true
  AND (target_user_ids IS NULL OR cardinality(target_user_ids) = 0)
  AND COALESCE(auto_generated, false) = false
ORDER BY created_at DESC;

-- 2) إيقاف رسائل "رسالة من الإدارة" الموجّهة القديمة (الأكثر أماناً ودقة):
UPDATE system_notifications
SET is_active = false
WHERE is_active = true
  AND (target_user_ids IS NULL OR cardinality(target_user_ids) = 0)
  AND title = 'رسالة من الإدارة';

-- 3) (اختياري وأشمل) إيقاف كل الرسائل اليدوية القديمة بلا استهداف دقيق،
--    ما عدا المناسبات التلقائية. أزل علامة التعليق فقط لو أردت تنظيفاً كاملاً
--    وكنت متأكداً أنه لا توجد رسائل عامة مقصودة تريد إبقاءها:
-- UPDATE system_notifications
--   SET is_active = false
--   WHERE is_active = true
--     AND (target_user_ids IS NULL OR cardinality(target_user_ids) = 0)
--     AND COALESCE(auto_generated, false) = false;

-- 4) تحقق أنه لم يتبقَّ رسائل عالقة:
SELECT count(*) AS remaining_broadcasts
FROM system_notifications
WHERE is_active = true
  AND (target_user_ids IS NULL OR cardinality(target_user_ids) = 0)
  AND COALESCE(auto_generated, false) = false;
