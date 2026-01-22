-- ==================== نظام فتح وإغلاق الفروع - Branch Opening/Closing System ====================
-- تاريخ الإنشاء: 2026-01-22
-- الوصف: جداول نظام فتح وإغلاق الفروع مع قوائم التحقق والتوقيعات الإلكترونية

-- ===== 1. قوالب قوائم التحقق - Checklist Templates =====
CREATE TABLE IF NOT EXISTS checklist_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    type TEXT NOT NULL, -- opening, closing
    category TEXT NOT NULL, -- cleanliness, equipment, products, inventory, cashier, employees, security, waste
    description TEXT,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    requires_photo BOOLEAN DEFAULT FALSE,
    requires_note BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_type ON checklist_templates(type);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_category ON checklist_templates(category);

COMMENT ON TABLE checklist_templates IS 'قوالب قوائم التحقق لنظام الفتح والإغلاق';
COMMENT ON COLUMN checklist_templates.type IS 'نوع القالب: opening (فتح) أو closing (إغلاق)';
COMMENT ON COLUMN checklist_templates.category IS 'فئة القالب: نظافة، معدات، منتجات، مخزون، كاشير، موظفين، أمان، هدر';

-- ===== 2. بنود قوائم التحقق - Checklist Items =====
CREATE TABLE IF NOT EXISTS checklist_items (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    title_en TEXT,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    requires_photo BOOLEAN DEFAULT FALSE,
    requires_note BOOLEAN DEFAULT FALSE,
    is_critical BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_template ON checklist_items(template_id);

COMMENT ON TABLE checklist_items IS 'بنود قوائم التحقق';
COMMENT ON COLUMN checklist_items.is_critical IS 'هل البند حرج ويجب إكماله؟';
COMMENT ON COLUMN checklist_items.requires_photo IS 'هل يتطلب البند صورة إلزامية؟';

-- ===== 3. سجل الشفتات - Branch Shifts =====
CREATE TABLE IF NOT EXISTS branch_shifts (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    shift_type TEXT NOT NULL, -- morning, evening, night
    shift_date DATE NOT NULL,
    status TEXT DEFAULT 'in_progress', -- in_progress, completed, pending_review
    supervisor_id VARCHAR REFERENCES users(id),
    supervisor_name TEXT,
    employee_count INTEGER,
    opening_time TIMESTAMP,
    closing_time TIMESTAMP,
    total_sales NUMERIC(12, 2),
    cash_sales NUMERIC(12, 2),
    card_sales NUMERIC(12, 2),
    transaction_count INTEGER,
    cash_variance NUMERIC(10, 2),
    waste_amount NUMERIC(10, 2),
    supervisor_notes TEXT,
    customer_feedback TEXT,
    team_performance TEXT,
    improvements TEXT,
    issues TEXT,
    opening_completed BOOLEAN DEFAULT FALSE,
    closing_completed BOOLEAN DEFAULT FALSE,
    opening_completed_at TIMESTAMP,
    closing_completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_branch_shifts_branch ON branch_shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_shifts_date ON branch_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_branch_shifts_status ON branch_shifts(status);
CREATE INDEX IF NOT EXISTS idx_branch_shifts_supervisor ON branch_shifts(supervisor_id);

COMMENT ON TABLE branch_shifts IS 'سجل شفتات الفروع اليومية';
COMMENT ON COLUMN branch_shifts.shift_type IS 'نوع الشفت: morning (صباحي), evening (مسائي), night (ليلي)';
COMMENT ON COLUMN branch_shifts.status IS 'حالة الشفت: in_progress, completed, pending_review';

-- ===== 4. استجابات قوائم التحقق - Shift Checklist Responses =====
CREATE TABLE IF NOT EXISTS shift_checklist_responses (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES branch_shifts(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES checklist_items(id),
    checklist_type TEXT NOT NULL, -- opening, closing
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    completed_by VARCHAR REFERENCES users(id),
    completed_by_name TEXT,
    notes TEXT,
    photo_url TEXT,
    status TEXT DEFAULT 'pending', -- pending, passed, failed, needs_attention
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shift_checklist_shift ON shift_checklist_responses(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_checklist_item ON shift_checklist_responses(item_id);
CREATE INDEX IF NOT EXISTS idx_shift_checklist_type ON shift_checklist_responses(checklist_type);

COMMENT ON TABLE shift_checklist_responses IS 'استجابات قوائم التحقق لكل شفت';
COMMENT ON COLUMN shift_checklist_responses.status IS 'حالة البند: pending, passed, failed, needs_attention';

-- ===== 5. صور الشفت - Shift Photos =====
CREATE TABLE IF NOT EXISTS shift_photos (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES branch_shifts(id) ON DELETE CASCADE,
    checklist_response_id INTEGER REFERENCES shift_checklist_responses(id) ON DELETE CASCADE,
    photo_type TEXT NOT NULL, -- checklist, general, issue, team
    category TEXT, -- cleanliness, equipment, products, etc.
    photo_url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT,
    uploaded_by VARCHAR REFERENCES users(id),
    uploaded_by_name TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shift_photos_shift ON shift_photos(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_photos_response ON shift_photos(checklist_response_id);
CREATE INDEX IF NOT EXISTS idx_shift_photos_type ON shift_photos(photo_type);

COMMENT ON TABLE shift_photos IS 'صور الشفت والتوثيق المصور';
COMMENT ON COLUMN shift_photos.photo_type IS 'نوع الصورة: checklist, general, issue, team';

-- ===== 6. التوقيعات الإلكترونية - Shift Signatures =====
CREATE TABLE IF NOT EXISTS shift_signatures (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES branch_shifts(id) ON DELETE CASCADE,
    signature_type TEXT NOT NULL, -- opening_supervisor, closing_supervisor, cashier, manager, opening, closing
    signature_data TEXT NOT NULL, -- base64 or URL
    signed_by VARCHAR REFERENCES users(id),
    signer_name TEXT NOT NULL,
    signer_role TEXT,
    signed_at TIMESTAMP DEFAULT NOW() NOT NULL,
    ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_shift_signatures_shift ON shift_signatures(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_signatures_type ON shift_signatures(signature_type);

COMMENT ON TABLE shift_signatures IS 'التوقيعات الإلكترونية للشفتات';
COMMENT ON COLUMN shift_signatures.signature_type IS 'نوع التوقيع: opening_supervisor, closing_supervisor, cashier, manager';
COMMENT ON COLUMN shift_signatures.signature_data IS 'بيانات التوقيع (base64 أو رابط)';

-- ===== 7. سجل الهدر اليومي - Daily Waste Log =====
CREATE TABLE IF NOT EXISTS daily_waste_log (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES branch_shifts(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT DEFAULT 'piece',
    reason TEXT NOT NULL, -- expired, damaged, overproduction, quality, other
    estimated_cost NUMERIC(10, 2),
    photo_url TEXT,
    notes TEXT,
    recorded_by VARCHAR REFERENCES users(id),
    recorded_by_name TEXT,
    recorded_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_waste_shift ON daily_waste_log(shift_id);
CREATE INDEX IF NOT EXISTS idx_daily_waste_reason ON daily_waste_log(reason);

COMMENT ON TABLE daily_waste_log IS 'سجل الهدر اليومي لكل شفت';
COMMENT ON COLUMN daily_waste_log.reason IS 'سبب الهدر: expired, damaged, overproduction, quality, other';

-- ==================== البيانات الافتراضية - Default Data ====================

-- إدراج قوالب قوائم التحقق الافتراضية للفتح
INSERT INTO checklist_templates (name, name_en, type, category, description, icon, display_order, requires_photo)
VALUES 
-- قوالب الفتح
('النظافة والتعقيم', 'Cleanliness & Sanitization', 'opening', 'cleanliness', 'التحقق من نظافة الفرع والتعقيم', 'sparkles', 1, true),
('المعدات والأجهزة', 'Equipment & Devices', 'opening', 'equipment', 'التحقق من عمل المعدات والأجهزة', 'settings', 2, false),
('المنتجات والعرض', 'Products & Display', 'opening', 'products', 'التحقق من جاهزية المنتجات والعرض', 'package', 3, true),
('الموظفين والحضور', 'Staff & Attendance', 'opening', 'employees', 'التحقق من حضور الموظفين', 'users', 4, false),
('الكاشير والصندوق', 'Cashier & Cash Drawer', 'opening', 'cashier', 'التحقق من جاهزية الكاشير', 'credit-card', 5, true),
-- قوالب الإغلاق
('إغلاق الكاشير', 'Cashier Closing', 'closing', 'cashier', 'إجراءات إغلاق الكاشير', 'credit-card', 1, true),
('النظافة النهائية', 'Final Cleaning', 'closing', 'cleanliness', 'تنظيف نهاية اليوم', 'sparkles', 2, true),
('تأمين المعدات', 'Equipment Security', 'closing', 'equipment', 'تأمين المعدات والأجهزة', 'lock', 3, false),
('جرد المنتجات', 'Product Inventory', 'closing', 'inventory', 'جرد المنتجات المتبقية', 'clipboard-list', 4, false),
('الأمن والسلامة', 'Security & Safety', 'closing', 'security', 'التحقق من الأمن قبل المغادرة', 'shield', 5, true)
ON CONFLICT DO NOTHING;

-- إدراج بنود قوائم التحقق الافتراضية
-- بنود قالب النظافة والتعقيم (الفتح)
INSERT INTO checklist_items (template_id, title, title_en, display_order, requires_photo, is_critical)
SELECT t.id, item.title, item.title_en, item.display_order, item.requires_photo, item.is_critical
FROM checklist_templates t
CROSS JOIN (VALUES
    ('التأكد من نظافة الأرضيات', 'Check floor cleanliness', 1, true, true),
    ('تنظيف وتعقيم الطاولات', 'Clean and sanitize tables', 2, true, true),
    ('تنظيف واجهات العرض', 'Clean display cabinets', 3, true, false),
    ('التأكد من نظافة دورات المياه', 'Check restroom cleanliness', 4, true, true),
    ('التخلص من النفايات', 'Dispose of garbage', 5, false, false)
) AS item(title, title_en, display_order, requires_photo, is_critical)
WHERE t.name = 'النظافة والتعقيم' AND t.type = 'opening'
ON CONFLICT DO NOTHING;

-- بنود قالب المعدات والأجهزة (الفتح)
INSERT INTO checklist_items (template_id, title, title_en, display_order, requires_photo, is_critical)
SELECT t.id, item.title, item.title_en, item.display_order, item.requires_photo, item.is_critical
FROM checklist_templates t
CROSS JOIN (VALUES
    ('تشغيل الأفران والتأكد من درجة الحرارة', 'Turn on ovens and check temperature', 1, false, true),
    ('تشغيل ثلاجات العرض', 'Turn on display refrigerators', 2, false, true),
    ('التأكد من عمل ماكينة القهوة', 'Check coffee machine operation', 3, false, false),
    ('التأكد من وجود آيباد المنيو', 'Check menu iPad availability', 4, true, true),
    ('شحن جميع الأجهزة والصرافات', 'Charge all devices and POS', 5, false, true)
) AS item(title, title_en, display_order, requires_photo, is_critical)
WHERE t.name = 'المعدات والأجهزة' AND t.type = 'opening'
ON CONFLICT DO NOTHING;

-- بنود قالب الكاشير والصندوق (الفتح)
INSERT INTO checklist_items (template_id, title, title_en, display_order, requires_photo, is_critical)
SELECT t.id, item.title, item.title_en, item.display_order, item.requires_photo, item.is_critical
FROM checklist_templates t
CROSS JOIN (VALUES
    ('عد الصندوق الافتتاحي', 'Count opening cash drawer', 1, true, true),
    ('التأكد من وجود فكة كافية', 'Check sufficient change', 2, false, true),
    ('تشغيل نظام الكاشير', 'Start POS system', 3, false, true),
    ('طباعة تقرير فتح الصندوق', 'Print opening cash report', 4, true, false)
) AS item(title, title_en, display_order, requires_photo, is_critical)
WHERE t.name = 'الكاشير والصندوق' AND t.type = 'opening'
ON CONFLICT DO NOTHING;

-- بنود قالب إغلاق الكاشير
INSERT INTO checklist_items (template_id, title, title_en, display_order, requires_photo, is_critical)
SELECT t.id, item.title, item.title_en, item.display_order, item.requires_photo, item.is_critical
FROM checklist_templates t
CROSS JOIN (VALUES
    ('عد الصندوق الختامي', 'Count closing cash drawer', 1, true, true),
    ('طباعة تقرير المبيعات اليومي', 'Print daily sales report', 2, true, true),
    ('مطابقة المبيعات مع الصندوق', 'Reconcile sales with cash', 3, false, true),
    ('إيداع المبيعات في الخزنة', 'Deposit sales in safe', 4, false, true)
) AS item(title, title_en, display_order, requires_photo, is_critical)
WHERE t.name = 'إغلاق الكاشير' AND t.type = 'closing'
ON CONFLICT DO NOTHING;

-- بنود قالب الأمن والسلامة (الإغلاق)
INSERT INTO checklist_items (template_id, title, title_en, display_order, requires_photo, is_critical)
SELECT t.id, item.title, item.title_en, item.display_order, item.requires_photo, item.is_critical
FROM checklist_templates t
CROSS JOIN (VALUES
    ('إغلاق جميع الأبواب والنوافذ', 'Lock all doors and windows', 1, true, true),
    ('تشغيل نظام الإنذار', 'Activate alarm system', 2, false, true),
    ('إطفاء جميع الأضواء غير الضرورية', 'Turn off unnecessary lights', 3, false, false),
    ('التأكد من إغلاق الغاز', 'Check gas is off', 4, false, true),
    ('تصوير الواجهة بعد الإغلاق', 'Photo of storefront after closing', 5, true, true)
) AS item(title, title_en, display_order, requires_photo, is_critical)
WHERE t.name = 'الأمن والسلامة' AND t.type = 'closing'
ON CONFLICT DO NOTHING;

-- ==================== نهاية الملف ====================
