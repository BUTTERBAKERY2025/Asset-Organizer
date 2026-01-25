-- إضافة الأعمدة الناقصة في جدول system_audit_logs
-- مطلوب تنفيذها يدوياً في Supabase SQL Editor قبل نشر الكود

-- إضافة عمود target_id للإجراءات الأمنية والـ RBAC
ALTER TABLE system_audit_logs 
ADD COLUMN IF NOT EXISTS target_id TEXT;

-- إضافة عمود description للوصف المقروء
ALTER TABLE system_audit_logs 
ADD COLUMN IF NOT EXISTS description TEXT;

-- فهرس للبحث بالـ target_id
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON system_audit_logs(target_id);

-- فهرس للبحث بالتاريخ والموديول
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_module ON system_audit_logs(created_at DESC, module);
