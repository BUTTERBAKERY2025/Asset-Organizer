-- ==================== تحديثات نظام فتح وإغلاق الفروع - GPS والتدقيق ====================
-- تاريخ الإنشاء: 2026-01-22
-- الوصف: إضافة حقول الموقع الجغرافي وبصمة الوقت وسجل التدقيق

-- ===== 1. إضافة حقول GPS لجدول الشفتات =====
ALTER TABLE branch_shifts 
ADD COLUMN IF NOT EXISTS opening_gps_latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS opening_gps_longitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS closing_gps_latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS closing_gps_longitude NUMERIC(10, 7);

COMMENT ON COLUMN branch_shifts.opening_gps_latitude IS 'خط العرض عند الفتح';
COMMENT ON COLUMN branch_shifts.opening_gps_longitude IS 'خط الطول عند الفتح';
COMMENT ON COLUMN branch_shifts.closing_gps_latitude IS 'خط العرض عند الإغلاق';
COMMENT ON COLUMN branch_shifts.closing_gps_longitude IS 'خط الطول عند الإغلاق';

-- ===== 2. إضافة حقول بصمة الوقت للصور =====
ALTER TABLE shift_photos 
ADD COLUMN IF NOT EXISTS device_timestamp TIMESTAMP,
ADD COLUMN IF NOT EXISTS gps_latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS gps_longitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS device_info TEXT;

COMMENT ON COLUMN shift_photos.device_timestamp IS 'وقت التقاط الصورة من الجهاز';
COMMENT ON COLUMN shift_photos.gps_latitude IS 'خط العرض عند التقاط الصورة';
COMMENT ON COLUMN shift_photos.gps_longitude IS 'خط الطول عند التقاط الصورة';
COMMENT ON COLUMN shift_photos.device_info IS 'معلومات الجهاز المستخدم';

-- ===== 3. جدول سجل التدقيق للشفتات =====
CREATE TABLE IF NOT EXISTS shift_audit_log (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES branch_shifts(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- create, update, complete_opening, complete_closing, add_photo, add_signature
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    performed_by VARCHAR REFERENCES users(id),
    performed_by_name TEXT,
    ip_address TEXT,
    user_agent TEXT,
    gps_latitude NUMERIC(10, 7),
    gps_longitude NUMERIC(10, 7),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shift_audit_shift ON shift_audit_log(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_audit_action ON shift_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_shift_audit_date ON shift_audit_log(created_at);

COMMENT ON TABLE shift_audit_log IS 'سجل تدقيق تعديلات الشفتات';
COMMENT ON COLUMN shift_audit_log.action IS 'نوع العملية: create, update, complete_opening, complete_closing, add_photo, add_signature';

-- ===== 4. جدول قوالب مخصصة للفروع =====
CREATE TABLE IF NOT EXISTS branch_custom_checklist_items (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    template_id INTEGER NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    title_en TEXT,
    description TEXT,
    display_order INTEGER DEFAULT 100,
    requires_photo BOOLEAN DEFAULT FALSE,
    requires_note BOOLEAN DEFAULT FALSE,
    is_critical BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_branch_custom_items_branch ON branch_custom_checklist_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_custom_items_template ON branch_custom_checklist_items(template_id);

COMMENT ON TABLE branch_custom_checklist_items IS 'بنود قوائم تحقق مخصصة لكل فرع';

-- ===== 5. جدول تذكيرات الشفتات =====
CREATE TABLE IF NOT EXISTS shift_reminders (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    reminder_type TEXT NOT NULL, -- opening_not_started, opening_incomplete, closing_not_started, closing_incomplete
    shift_date DATE NOT NULL,
    shift_type TEXT NOT NULL,
    reminder_time TIMESTAMP NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    sent_to VARCHAR[], -- array of user IDs
    notification_channels TEXT[] DEFAULT ARRAY['system'], -- system, email, sms
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shift_reminders_branch ON shift_reminders(branch_id);
CREATE INDEX IF NOT EXISTS idx_shift_reminders_date ON shift_reminders(shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_reminders_sent ON shift_reminders(is_sent);

COMMENT ON TABLE shift_reminders IS 'تذكيرات الشفتات غير المكتملة';
COMMENT ON COLUMN shift_reminders.reminder_type IS 'نوع التذكير: opening_not_started, opening_incomplete, closing_not_started, closing_incomplete';

-- ===== 6. فهارس إضافية للأداء =====
CREATE INDEX IF NOT EXISTS idx_branch_shifts_completed ON branch_shifts(opening_completed, closing_completed);
CREATE INDEX IF NOT EXISTS idx_shift_responses_completed ON shift_checklist_responses(is_completed);

-- ==================== نهاية الملف ====================
