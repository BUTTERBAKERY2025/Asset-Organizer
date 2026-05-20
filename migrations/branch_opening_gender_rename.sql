-- ترقية: تحويل عمود nationality إلى gender في جدول ضيوف افتتاح الفروع
-- شغّل هذا الملف في Supabase SQL Editor قبل نشر هذا التحديث على Render
ALTER TABLE branch_opening_guests RENAME COLUMN nationality TO gender;
