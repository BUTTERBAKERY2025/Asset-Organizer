-- =============================================================
-- تحديث قاعدة بيانات الإنتاج (Supabase) — نظام الإجازات المرحلة 2
-- نفّذ هذا الملف في Supabase SQL Editor قبل نشر الكود على Render
-- التغييرات: جدول العطلات الرسمية + عمود تفصيل مراحل الإجازة المرضية
-- كل الأوامر آمنة للتكرار (IF NOT EXISTS)
-- =============================================================

-- 1) جدول العطلات الرسمية (تُستثنى من أيام العمل عند حساب الإجازات)
CREATE TABLE IF NOT EXISTS public_holidays (
  id serial PRIMARY KEY,
  name text NOT NULL,
  start_date text NOT NULL,
  end_date text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_by varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_holidays_dates
  ON public_holidays(start_date, end_date);

-- 2) عمود تفصيل مراحل الإجازة المرضية (المادة 117 من نظام العمل)
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS sick_tier_breakdown jsonb;

-- 3) عمود الوسائط في طابور الإشعارات (مطلوب لتذكير العودة من الإجازة)
ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS media_url text;

-- 4) فهرس فريد جزئي يمنع تكرار تذكيرات العودة من الإجازة (حتى مع التشغيل المتزامن)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_queue_return_reminder
  ON notification_queue (related_module, related_entity_id, channel)
  WHERE related_module = 'leave_return_reminder';
