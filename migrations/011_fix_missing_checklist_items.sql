-- ==================== إصلاح البنود الناقصة في قوائم التحقق ====================
-- تاريخ الإنشاء: 2026-01-22
-- الوصف: إضافة البنود الناقصة للقوالب "المنتجات والعرض" و"الموظفين والحضور"

-- ===== بنود قالب المنتجات والعرض (الفتح) =====
INSERT INTO checklist_items (template_id, title, title_en, display_order, requires_photo, is_critical)
SELECT t.id, item.title, item.title_en, item.display_order, item.requires_photo, item.is_critical
FROM checklist_templates t
CROSS JOIN (VALUES
    ('التأكد من جاهزية المخبوزات للعرض', 'Check bakery products ready for display', 1, true, true),
    ('توفر وترتيب منتجات الباستري', 'Pastry products availability and arrangement', 2, true, false),
    ('التأكد من تواريخ الصلاحية', 'Check expiry dates', 3, false, true),
    ('تسعير المنتجات بشكل صحيح', 'Check product pricing', 4, false, true),
    ('جاهزية منتجات القهوة', 'Coffee products ready', 5, false, false),
    ('التأكد من نظافة منطقة العرض', 'Check display area cleanliness', 6, true, false)
) AS item(title, title_en, display_order, requires_photo, is_critical)
WHERE t.name = 'المنتجات والعرض' AND t.type = 'opening'
ON CONFLICT DO NOTHING;

-- ===== بنود قالب الموظفين والحضور (الفتح) =====
INSERT INTO checklist_items (template_id, title, title_en, display_order, requires_photo, is_critical)
SELECT t.id, item.title, item.title_en, item.display_order, item.requires_photo, item.is_critical
FROM checklist_templates t
CROSS JOIN (VALUES
    ('التأكد من حضور جميع الموظفين', 'Confirm all staff present', 1, false, true),
    ('التأكد من الزي الرسمي', 'Check uniforms', 2, true, true),
    ('توزيع المهام على الموظفين', 'Assign tasks to staff', 3, false, true),
    ('التأكد من النظافة الشخصية', 'Check personal hygiene', 4, false, true),
    ('تسجيل الحضور في النظام', 'Record attendance in system', 5, false, false)
) AS item(title, title_en, display_order, requires_photo, is_critical)
WHERE t.name = 'الموظفين والحضور' AND t.type = 'opening'
ON CONFLICT DO NOTHING;

-- ===== بنود قالب النظافة النهائية (الإغلاق) =====
INSERT INTO checklist_items (template_id, title, title_en, display_order, requires_photo, is_critical)
SELECT t.id, item.title, item.title_en, item.display_order, item.requires_photo, item.is_critical
FROM checklist_templates t
CROSS JOIN (VALUES
    ('تنظيف الأرضيات', 'Clean floors', 1, true, true),
    ('تنظيف الطاولات والكراسي', 'Clean tables and chairs', 2, true, false),
    ('تنظيف واجهات العرض', 'Clean display cabinets', 3, true, false),
    ('تنظيف دورات المياه', 'Clean restrooms', 4, true, true),
    ('التخلص من النفايات', 'Dispose of garbage', 5, false, true)
) AS item(title, title_en, display_order, requires_photo, is_critical)
WHERE t.name = 'النظافة النهائية' AND t.type = 'closing'
ON CONFLICT DO NOTHING;

-- ===== بنود قالب تأمين المعدات (الإغلاق) =====
INSERT INTO checklist_items (template_id, title, title_en, display_order, requires_photo, is_critical)
SELECT t.id, item.title, item.title_en, item.display_order, item.requires_photo, item.is_critical
FROM checklist_templates t
CROSS JOIN (VALUES
    ('إطفاء الأفران', 'Turn off ovens', 1, false, true),
    ('إغلاق ثلاجات العرض', 'Close display refrigerators', 2, false, false),
    ('إغلاق ماكينة القهوة', 'Turn off coffee machine', 3, false, false),
    ('التأكد من سلامة الأجهزة', 'Check equipment safety', 4, false, true)
) AS item(title, title_en, display_order, requires_photo, is_critical)
WHERE t.name = 'تأمين المعدات' AND t.type = 'closing'
ON CONFLICT DO NOTHING;

-- ===== بنود قالب جرد المنتجات (الإغلاق) =====
INSERT INTO checklist_items (template_id, title, title_en, display_order, requires_photo, is_critical)
SELECT t.id, item.title, item.title_en, item.display_order, item.requires_photo, item.is_critical
FROM checklist_templates t
CROSS JOIN (VALUES
    ('جرد المخبوزات المتبقية', 'Inventory remaining bakery products', 1, true, true),
    ('تسجيل الهدر والتالف', 'Record waste and damaged items', 2, false, true),
    ('التأكد من تخزين المنتجات', 'Check product storage', 3, false, false),
    ('تسجيل المنتجات المطلوب تحضيرها غداً', 'Record products needed for tomorrow', 4, false, false)
) AS item(title, title_en, display_order, requires_photo, is_critical)
WHERE t.name = 'جرد المنتجات' AND t.type = 'closing'
ON CONFLICT DO NOTHING;

-- ===== تحديث نص البند "ترتيب فاترينة العرض" =====
UPDATE checklist_items 
SET title = 'توفر وترتيب منتجات الباستري', 
    title_en = 'Pastry products availability and arrangement'
WHERE title = 'ترتيب فاترينة العرض';

-- التحقق من النتائج
SELECT ct.name, ct.type, COUNT(ci.id) as items_count
FROM checklist_templates ct
LEFT JOIN checklist_items ci ON ci.template_id = ct.id
GROUP BY ct.id, ct.name, ct.type
ORDER BY ct.type, ct.id;

-- ==================== نهاية الملف ====================
