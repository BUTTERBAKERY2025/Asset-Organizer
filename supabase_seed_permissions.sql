-- ==========================================
-- Seed All System Permissions
-- بذر جميع صلاحيات النظام
-- Execute in Supabase SQL Editor AFTER rbac_security_enhancement.sql
-- ==========================================

-- Clear existing permissions (optional - uncomment if needed)
-- TRUNCATE permissions CASCADE;

-- ==========================================
-- الأساسية - Core
-- ==========================================
INSERT INTO permissions (module, action, name, description, is_default) VALUES
-- لوحة التحكم
('dashboard', 'view', 'عرض لوحة التحكم', 'عرض لوحة التحكم الرئيسية', true),
('dashboard', 'export', 'تصدير بيانات لوحة التحكم', 'تصدير تقارير لوحة التحكم', false),
-- الصفحة الرئيسية
('platform_home', 'view', 'عرض الصفحة الرئيسية', 'الوصول للصفحة الرئيسية', true),
-- الإعدادات
('settings', 'view', 'عرض الإعدادات', 'عرض إعدادات النظام', false),
('settings', 'edit', 'تعديل الإعدادات', 'تعديل إعدادات النظام', false)
ON CONFLICT DO NOTHING;

-- ==========================================
-- المخزون والأصول - Inventory & Assets
-- ==========================================
INSERT INTO permissions (module, action, name, description, is_default) VALUES
-- المخزون
('inventory', 'view', 'عرض المخزون', 'عرض قوائم المخزون', true),
('inventory', 'create', 'إضافة أصناف', 'إضافة أصناف جديدة للمخزون', false),
('inventory', 'edit', 'تعديل المخزون', 'تعديل بيانات المخزون', false),
('inventory', 'delete', 'حذف من المخزون', 'حذف أصناف من المخزون', false),
('inventory', 'export', 'تصدير المخزون', 'تصدير بيانات المخزون', false),
('inventory', 'approve', 'اعتماد عمليات المخزون', 'اعتماد عمليات الجرد والتعديل', false),
-- تحويلات الأصول
('asset_transfers', 'view', 'عرض التحويلات', 'عرض تحويلات الأصول', true),
('asset_transfers', 'create', 'إنشاء تحويل', 'إنشاء طلب تحويل أصول', false),
('asset_transfers', 'edit', 'تعديل التحويل', 'تعديل طلب التحويل', false),
('asset_transfers', 'delete', 'حذف التحويل', 'حذف طلب التحويل', false),
('asset_transfers', 'approve', 'اعتماد التحويل', 'اعتماد طلبات التحويل', false),
('asset_transfers', 'export', 'تصدير التحويلات', 'تصدير سجل التحويلات', false),
-- التفتيش والجرد
('inspections', 'view', 'عرض التفتيش', 'عرض سجلات التفتيش', true),
('inspections', 'create', 'إنشاء تفتيش', 'إنشاء سجل تفتيش جديد', false),
('inspections', 'edit', 'تعديل التفتيش', 'تعديل سجل التفتيش', false),
('inspections', 'delete', 'حذف التفتيش', 'حذف سجل التفتيش', false),
('inspections', 'approve', 'اعتماد التفتيش', 'اعتماد نتائج التفتيش', false),
-- الصيانة
('maintenance', 'view', 'عرض الصيانة', 'عرض طلبات الصيانة', true),
('maintenance', 'create', 'إنشاء طلب صيانة', 'إنشاء طلب صيانة جديد', false),
('maintenance', 'edit', 'تعديل طلب الصيانة', 'تعديل طلب الصيانة', false),
('maintenance', 'delete', 'حذف طلب الصيانة', 'حذف طلب الصيانة', false),
('maintenance', 'approve', 'اعتماد الصيانة', 'اعتماد طلبات الصيانة', false),
('maintenance', 'change_status', 'تغيير حالة الصيانة', 'تغيير حالة طلب الصيانة', false)
ON CONFLICT DO NOTHING;

-- ==========================================
-- الإنتاج والتشغيل - Production & Operations
-- ==========================================
INSERT INTO permissions (module, action, name, description, is_default) VALUES
-- الإنتاج
('production', 'view', 'عرض الإنتاج', 'عرض بيانات الإنتاج', true),
('production', 'create', 'إضافة إنتاج', 'إضافة سجلات إنتاج', false),
('production', 'edit', 'تعديل الإنتاج', 'تعديل سجلات الإنتاج', false),
('production', 'delete', 'حذف الإنتاج', 'حذف سجلات الإنتاج', false),
('production', 'export', 'تصدير الإنتاج', 'تصدير تقارير الإنتاج', false),
-- الإنتاج اليومي
('daily_production', 'view', 'عرض الإنتاج اليومي', 'عرض الإنتاج اليومي', true),
('daily_production', 'create', 'تسجيل إنتاج يومي', 'تسجيل دفعات الإنتاج', false),
('daily_production', 'edit', 'تعديل الإنتاج اليومي', 'تعديل سجلات الإنتاج اليومي', false),
('daily_production', 'delete', 'حذف الإنتاج اليومي', 'حذف سجلات الإنتاج اليومي', false),
-- أوامر الإنتاج المتقدمة
('advanced_production', 'view', 'عرض أوامر الإنتاج', 'عرض أوامر الإنتاج المتقدمة', true),
('advanced_production', 'create', 'إنشاء أمر إنتاج', 'إنشاء أمر إنتاج جديد', false),
('advanced_production', 'edit', 'تعديل أمر الإنتاج', 'تعديل أمر الإنتاج', false),
('advanced_production', 'delete', 'حذف أمر الإنتاج', 'حذف أمر الإنتاج', false),
('advanced_production', 'approve', 'اعتماد أمر الإنتاج', 'اعتماد أوامر الإنتاج', false),
('advanced_production', 'change_status', 'تغيير حالة الأمر', 'تغيير حالة أمر الإنتاج', false),
-- مراقبة الجودة
('quality_control', 'view', 'عرض الجودة', 'عرض سجلات الجودة', true),
('quality_control', 'create', 'إنشاء فحص جودة', 'إنشاء سجل فحص جودة', false),
('quality_control', 'edit', 'تعديل فحص الجودة', 'تعديل سجل فحص الجودة', false),
('quality_control', 'delete', 'حذف فحص الجودة', 'حذف سجل فحص الجودة', false),
('quality_control', 'approve', 'اعتماد الجودة', 'اعتماد نتائج فحص الجودة', false),
-- المنتجات
('products', 'view', 'عرض المنتجات', 'عرض قائمة المنتجات', true),
('products', 'create', 'إضافة منتج', 'إضافة منتج جديد', false),
('products', 'edit', 'تعديل منتج', 'تعديل بيانات المنتج', false),
('products', 'delete', 'حذف منتج', 'حذف منتج', false),
-- التشغيل
('operations', 'view', 'عرض التشغيل', 'عرض لوحة التشغيل', true),
('operations', 'create', 'إضافة عمليات', 'إضافة سجلات تشغيل', false),
('operations', 'edit', 'تعديل التشغيل', 'تعديل سجلات التشغيل', false),
('operations', 'export', 'تصدير التشغيل', 'تصدير تقارير التشغيل', false),
-- مخطط الإنتاج الذكي
('ai_production_planner', 'view', 'عرض مخطط الإنتاج', 'عرض مخطط الإنتاج الذكي', false),
('ai_production_planner', 'create', 'إنشاء خطة إنتاج', 'إنشاء خطة إنتاج ذكية', false),
('ai_production_planner', 'approve', 'اعتماد خطة الإنتاج', 'اعتماد خطط الإنتاج', false)
ON CONFLICT DO NOTHING;

-- ==========================================
-- الورديات والحضور - Shifts & Attendance
-- ==========================================
INSERT INTO permissions (module, action, name, description, is_default) VALUES
-- الورديات
('shifts', 'view', 'عرض الورديات', 'عرض جداول الورديات', true),
('shifts', 'create', 'إنشاء وردية', 'إنشاء وردية جديدة', false),
('shifts', 'edit', 'تعديل الوردية', 'تعديل بيانات الوردية', false),
('shifts', 'delete', 'حذف الوردية', 'حذف الوردية', false),
('shifts', 'approve', 'اعتماد الوردية', 'اعتماد جداول الورديات', false),
-- الحضور والانصراف
('attendance', 'view', 'عرض الحضور', 'عرض سجلات الحضور', true),
('attendance', 'create', 'تسجيل حضور', 'تسجيل حضور/انصراف', false),
('attendance', 'edit', 'تعديل الحضور', 'تعديل سجلات الحضور', false),
('attendance', 'delete', 'حذف سجل حضور', 'حذف سجل حضور', false),
('attendance', 'approve', 'اعتماد الحضور', 'اعتماد سجلات الحضور', false),
('attendance', 'export', 'تصدير الحضور', 'تصدير تقارير الحضور', false),
-- كشوف الدوام
('timesheet', 'view', 'عرض كشوف الدوام', 'عرض كشوف الدوام', true),
('timesheet', 'create', 'إنشاء كشف دوام', 'إنشاء كشف دوام', false),
('timesheet', 'edit', 'تعديل كشف الدوام', 'تعديل كشف الدوام', false),
('timesheet', 'approve', 'اعتماد كشف الدوام', 'اعتماد كشوف الدوام', false),
('timesheet', 'export', 'تصدير كشف الدوام', 'تصدير كشوف الدوام', false),
('timesheet', 'sign', 'توقيع كشف الدوام', 'التوقيع على كشف الدوام', false)
ON CONFLICT DO NOTHING;

-- ==========================================
-- الموظفين والموارد البشرية - HR
-- ==========================================
INSERT INTO permissions (module, action, name, description, is_default) VALUES
-- إدارة المستخدمين
('users', 'view', 'عرض المستخدمين', 'عرض قائمة المستخدمين', false),
('users', 'create', 'إضافة مستخدم', 'إضافة مستخدم جديد', false),
('users', 'edit', 'تعديل مستخدم', 'تعديل بيانات المستخدم', false),
('users', 'delete', 'حذف مستخدم', 'حذف مستخدم', false),
('users', 'change_status', 'تفعيل/تعطيل مستخدم', 'تفعيل أو تعطيل حساب مستخدم', false),
-- موظفي الفروع
('branch_employees', 'view', 'عرض موظفي الفرع', 'عرض قائمة موظفي الفرع', true),
('branch_employees', 'create', 'إضافة موظف للفرع', 'إضافة موظف جديد للفرع', false),
('branch_employees', 'edit', 'تعديل بيانات الموظف', 'تعديل بيانات موظف الفرع', false),
('branch_employees', 'delete', 'حذف موظف', 'حذف موظف من الفرع', false),
('branch_employees', 'change_status', 'تغيير حالة الموظف', 'تغيير حالة موظف الفرع', false),
-- الفروع
('branches', 'view', 'عرض الفروع', 'عرض قائمة الفروع', true),
('branches', 'create', 'إضافة فرع', 'إضافة فرع جديد', false),
('branches', 'edit', 'تعديل الفرع', 'تعديل بيانات الفرع', false),
('branches', 'delete', 'حذف الفرع', 'حذف الفرع', false),
-- الهيكل التنظيمي
('organizational_structure', 'view', 'عرض الهيكل التنظيمي', 'عرض الهيكل التنظيمي', true),
('organizational_structure', 'create', 'إضافة وظيفة', 'إضافة وظيفة للهيكل', false),
('organizational_structure', 'edit', 'تعديل الهيكل', 'تعديل الهيكل التنظيمي', false),
('organizational_structure', 'delete', 'حذف وظيفة', 'حذف وظيفة من الهيكل', false),
-- تقارير الموظفين
('employee_reports', 'view', 'عرض تقارير الموظفين', 'عرض تقارير الموظفين', true),
('employee_reports', 'export', 'تصدير تقارير الموظفين', 'تصدير تقارير الموظفين', false),
('employee_reports', 'print', 'طباعة تقارير الموظفين', 'طباعة تقارير الموظفين', false),
-- تحويلات الموظفين
('employee_transfers', 'view', 'عرض تحويلات الموظفين', 'عرض طلبات تحويل الموظفين', true),
('employee_transfers', 'create', 'إنشاء طلب تحويل', 'إنشاء طلب تحويل موظف', false),
('employee_transfers', 'edit', 'تعديل طلب التحويل', 'تعديل طلب التحويل', false),
('employee_transfers', 'delete', 'حذف طلب التحويل', 'حذف طلب التحويل', false),
('employee_transfers', 'approve', 'اعتماد التحويل', 'اعتماد طلبات تحويل الموظفين', false)
ON CONFLICT DO NOTHING;

-- ==========================================
-- المالية والكاشير - Finance & Cashier
-- ==========================================
INSERT INTO permissions (module, action, name, description, is_default) VALUES
-- يومية الكاشير
('cashier_journal', 'view', 'عرض يومية الكاشير', 'عرض يوميات الكاشير', true),
('cashier_journal', 'create', 'إنشاء يومية', 'إنشاء يومية كاشير جديدة', false),
('cashier_journal', 'edit', 'تعديل اليومية', 'تعديل يومية الكاشير', false),
('cashier_journal', 'delete', 'حذف اليومية', 'حذف يومية الكاشير', false),
('cashier_journal', 'approve', 'اعتماد اليومية', 'اعتماد يومية الكاشير', false),
('cashier_journal', 'sign', 'توقيع اليومية', 'التوقيع على يومية الكاشير', false),
('cashier_journal', 'export', 'تصدير اليومية', 'تصدير يوميات الكاشير', false),
-- أداء الكاشير
('cashier_performance', 'view', 'عرض أداء الكاشير', 'عرض تقارير أداء الكاشير', true),
('cashier_performance', 'export', 'تصدير أداء الكاشير', 'تصدير تقارير الأداء', false),
-- لوحة الأرباح والخسائر
('pnl_dashboard', 'view', 'عرض P&L', 'عرض لوحة الأرباح والخسائر', false),
('pnl_dashboard', 'create', 'إدخال بيانات P&L', 'إدخال بيانات مالية', false),
('pnl_dashboard', 'edit', 'تعديل بيانات P&L', 'تعديل البيانات المالية', false),
('pnl_dashboard', 'delete', 'حذف بيانات P&L', 'حذف البيانات المالية', false),
('pnl_dashboard', 'export', 'تصدير P&L', 'تصدير تقارير P&L', false),
('pnl_dashboard', 'approve', 'اعتماد P&L', 'اعتماد البيانات المالية', false),
-- الحوافز
('incentives', 'view', 'عرض الحوافز', 'عرض نظام الحوافز', true),
('incentives', 'create', 'إنشاء حافز', 'إنشاء حافز جديد', false),
('incentives', 'edit', 'تعديل الحوافز', 'تعديل نظام الحوافز', false),
('incentives', 'delete', 'حذف الحوافز', 'حذف الحوافز', false),
('incentives', 'approve', 'اعتماد الحوافز', 'اعتماد صرف الحوافز', false),
-- تحليلات المبيعات
('sales_analytics', 'view', 'عرض تحليلات المبيعات', 'عرض تحليلات المبيعات', true),
('sales_analytics', 'export', 'تصدير تحليلات المبيعات', 'تصدير تقارير المبيعات', false),
-- رفع بيانات المبيعات
('sales_uploads', 'view', 'عرض رفع المبيعات', 'عرض ملفات المبيعات المرفوعة', false),
('sales_uploads', 'create', 'رفع بيانات المبيعات', 'رفع ملفات بيانات المبيعات', false),
('sales_uploads', 'delete', 'حذف ملفات المبيعات', 'حذف ملفات المبيعات المرفوعة', false)
ON CONFLICT DO NOTHING;

-- ==========================================
-- الأهداف والأداء - Targets & Performance
-- ==========================================
INSERT INTO permissions (module, action, name, description, is_default) VALUES
-- الأهداف
('targets', 'view', 'عرض الأهداف', 'عرض أهداف المبيعات', true),
('targets', 'create', 'إنشاء هدف', 'إنشاء هدف جديد', false),
('targets', 'edit', 'تعديل الأهداف', 'تعديل الأهداف', false),
('targets', 'delete', 'حذف الأهداف', 'حذف الأهداف', false),
('targets', 'approve', 'اعتماد الأهداف', 'اعتماد الأهداف', false),
-- تخطيط الأهداف
('targets_planning', 'view', 'عرض تخطيط الأهداف', 'عرض خطط الأهداف', true),
('targets_planning', 'create', 'إنشاء خطة أهداف', 'إنشاء خطة أهداف', false),
('targets_planning', 'edit', 'تعديل خطة الأهداف', 'تعديل خطط الأهداف', false),
('targets_planning', 'delete', 'حذف خطة الأهداف', 'حذف خطط الأهداف', false),
('targets_planning', 'approve', 'اعتماد خطة الأهداف', 'اعتماد خطط الأهداف', false),
-- تتبع الهدر
('waste_tracking', 'view', 'عرض الهدر', 'عرض سجلات الهدر', true),
('waste_tracking', 'create', 'تسجيل هدر', 'تسجيل هدر جديد', false),
('waste_tracking', 'edit', 'تعديل الهدر', 'تعديل سجلات الهدر', false),
('waste_tracking', 'delete', 'حذف سجل هدر', 'حذف سجل الهدر', false),
('waste_tracking', 'export', 'تصدير الهدر', 'تصدير تقارير الهدر', false)
ON CONFLICT DO NOTHING;

-- ==========================================
-- مشاريع الإنشاء - Construction Projects
-- ==========================================
INSERT INTO permissions (module, action, name, description, is_default) VALUES
-- مشاريع الإنشاءات
('construction_projects', 'view', 'عرض المشاريع', 'عرض مشاريع الإنشاءات', true),
('construction_projects', 'create', 'إنشاء مشروع', 'إنشاء مشروع جديد', false),
('construction_projects', 'edit', 'تعديل المشروع', 'تعديل بيانات المشروع', false),
('construction_projects', 'delete', 'حذف المشروع', 'حذف المشروع', false),
('construction_projects', 'approve', 'اعتماد المشروع', 'اعتماد المشاريع', false),
('construction_projects', 'change_status', 'تغيير حالة المشروع', 'تغيير حالة المشروع', false),
('construction_projects', 'export', 'تصدير المشاريع', 'تصدير تقارير المشاريع', false),
-- بنود الأعمال
('construction_work_items', 'view', 'عرض بنود الأعمال', 'عرض بنود أعمال المشروع', true),
('construction_work_items', 'create', 'إضافة بند عمل', 'إضافة بند عمل جديد', false),
('construction_work_items', 'edit', 'تعديل بند العمل', 'تعديل بند العمل', false),
('construction_work_items', 'delete', 'حذف بند العمل', 'حذف بند العمل', false),
('construction_work_items', 'approve', 'اعتماد بند العمل', 'اعتماد بنود الأعمال', false),
-- تقارير المشاريع
('construction_reports', 'view', 'عرض تقارير المشاريع', 'عرض تقارير المشاريع', true),
('construction_reports', 'export', 'تصدير تقارير المشاريع', 'تصدير تقارير المشاريع', false),
('construction_reports', 'print', 'طباعة تقارير المشاريع', 'طباعة تقارير المشاريع', false),
-- المقاولين
('contractors', 'view', 'عرض المقاولين', 'عرض قائمة المقاولين', true),
('contractors', 'create', 'إضافة مقاول', 'إضافة مقاول جديد', false),
('contractors', 'edit', 'تعديل المقاول', 'تعديل بيانات المقاول', false),
('contractors', 'delete', 'حذف المقاول', 'حذف المقاول', false),
-- العقود
('contracts', 'view', 'عرض العقود', 'عرض العقود', true),
('contracts', 'create', 'إنشاء عقد', 'إنشاء عقد جديد', false),
('contracts', 'edit', 'تعديل العقد', 'تعديل بيانات العقد', false),
('contracts', 'delete', 'حذف العقد', 'حذف العقد', false),
('contracts', 'approve', 'اعتماد العقد', 'اعتماد العقود', false),
('contracts', 'sign', 'توقيع العقد', 'التوقيع على العقود', false),
-- تخطيط الميزانية
('budget_planning', 'view', 'عرض الميزانية', 'عرض تخطيط الميزانية', true),
('budget_planning', 'create', 'إنشاء ميزانية', 'إنشاء ميزانية جديدة', false),
('budget_planning', 'edit', 'تعديل الميزانية', 'تعديل الميزانية', false),
('budget_planning', 'delete', 'حذف الميزانية', 'حذف الميزانية', false),
('budget_planning', 'approve', 'اعتماد الميزانية', 'اعتماد الميزانيات', false),
-- طلبات الصرف
('payment_requests', 'view', 'عرض طلبات الصرف', 'عرض طلبات الصرف', true),
('payment_requests', 'create', 'إنشاء طلب صرف', 'إنشاء طلب صرف جديد', false),
('payment_requests', 'edit', 'تعديل طلب الصرف', 'تعديل طلب الصرف', false),
('payment_requests', 'delete', 'حذف طلب الصرف', 'حذف طلب الصرف', false),
('payment_requests', 'approve', 'اعتماد طلب الصرف', 'اعتماد طلبات الصرف', false)
ON CONFLICT DO NOTHING;

-- ==========================================
-- التسويق - Marketing
-- ==========================================
INSERT INTO permissions (module, action, name, description, is_default) VALUES
-- التسويق العام
('marketing', 'view', 'عرض التسويق', 'عرض لوحة التسويق', true),
('marketing', 'create', 'إضافة تسويق', 'إضافة محتوى تسويقي', false),
('marketing', 'edit', 'تعديل التسويق', 'تعديل محتوى التسويق', false),
('marketing', 'delete', 'حذف التسويق', 'حذف محتوى التسويق', false),
('marketing', 'export', 'تصدير التسويق', 'تصدير تقارير التسويق', false),
-- الحملات التسويقية
('marketing_campaigns', 'view', 'عرض الحملات', 'عرض الحملات التسويقية', true),
('marketing_campaigns', 'create', 'إنشاء حملة', 'إنشاء حملة تسويقية', false),
('marketing_campaigns', 'edit', 'تعديل الحملة', 'تعديل الحملة التسويقية', false),
('marketing_campaigns', 'delete', 'حذف الحملة', 'حذف الحملة التسويقية', false),
('marketing_campaigns', 'approve', 'اعتماد الحملة', 'اعتماد الحملات التسويقية', false),
-- المؤثرين
('marketing_influencers', 'view', 'عرض المؤثرين', 'عرض قائمة المؤثرين', true),
('marketing_influencers', 'create', 'إضافة مؤثر', 'إضافة مؤثر جديد', false),
('marketing_influencers', 'edit', 'تعديل المؤثر', 'تعديل بيانات المؤثر', false),
('marketing_influencers', 'delete', 'حذف المؤثر', 'حذف المؤثر', false),
('marketing_influencers', 'export', 'تصدير المؤثرين', 'تصدير قائمة المؤثرين', false),
-- مهام التسويق
('marketing_tasks', 'view', 'عرض مهام التسويق', 'عرض مهام التسويق', true),
('marketing_tasks', 'create', 'إنشاء مهمة', 'إنشاء مهمة تسويقية', false),
('marketing_tasks', 'edit', 'تعديل المهمة', 'تعديل مهمة التسويق', false),
('marketing_tasks', 'delete', 'حذف المهمة', 'حذف مهمة التسويق', false),
('marketing_tasks', 'change_status', 'تغيير حالة المهمة', 'تغيير حالة مهمة التسويق', false),
-- أهداف التسويق
('marketing_goals', 'view', 'عرض أهداف التسويق', 'عرض أهداف التسويق', true),
('marketing_goals', 'create', 'إنشاء هدف تسويقي', 'إنشاء هدف تسويقي', false),
('marketing_goals', 'edit', 'تعديل هدف التسويق', 'تعديل أهداف التسويق', false),
('marketing_goals', 'delete', 'حذف هدف التسويق', 'حذف أهداف التسويق', false),
-- تقويم التسويق
('marketing_calendar', 'view', 'عرض تقويم التسويق', 'عرض تقويم التسويق', true),
('marketing_calendar', 'create', 'إضافة حدث', 'إضافة حدث للتقويم', false),
('marketing_calendar', 'edit', 'تعديل الحدث', 'تعديل أحداث التقويم', false),
('marketing_calendar', 'delete', 'حذف الحدث', 'حذف أحداث التقويم', false),
-- تنبيهات التسويق
('marketing_alerts', 'view', 'عرض تنبيهات التسويق', 'عرض تنبيهات التسويق', true),
('marketing_alerts', 'create', 'إنشاء تنبيه', 'إنشاء تنبيه تسويقي', false),
('marketing_alerts', 'edit', 'تعديل التنبيه', 'تعديل تنبيهات التسويق', false),
('marketing_alerts', 'delete', 'حذف التنبيه', 'حذف تنبيهات التسويق', false),
-- أصول التسويق
('marketing_assets', 'view', 'عرض أصول التسويق', 'عرض الأصول التسويقية', true),
('marketing_assets', 'create', 'رفع أصل', 'رفع أصل تسويقي', false),
('marketing_assets', 'edit', 'تعديل الأصل', 'تعديل الأصول التسويقية', false),
('marketing_assets', 'delete', 'حذف الأصل', 'حذف الأصول التسويقية', false),
-- مصروفات التسويق
('marketing_expenses', 'view', 'عرض مصروفات التسويق', 'عرض مصروفات التسويق', true),
('marketing_expenses', 'create', 'إضافة مصروف', 'إضافة مصروف تسويقي', false),
('marketing_expenses', 'edit', 'تعديل المصروف', 'تعديل مصروفات التسويق', false),
('marketing_expenses', 'delete', 'حذف المصروف', 'حذف مصروفات التسويق', false),
('marketing_expenses', 'approve', 'اعتماد المصروف', 'اعتماد مصروفات التسويق', false),
-- تقارير التسويق
('marketing_reports', 'view', 'عرض تقارير التسويق', 'عرض تقارير التسويق', true),
('marketing_reports', 'export', 'تصدير تقارير التسويق', 'تصدير تقارير التسويق', false),
-- فريق التسويق
('marketing_team', 'view', 'عرض فريق التسويق', 'عرض أعضاء فريق التسويق', true),
('marketing_team', 'create', 'إضافة عضو للفريق', 'إضافة عضو لفريق التسويق', false),
('marketing_team', 'edit', 'تعديل عضو الفريق', 'تعديل بيانات عضو الفريق', false),
('marketing_team', 'delete', 'حذف عضو الفريق', 'حذف عضو من فريق التسويق', false)
ON CONFLICT DO NOTHING;

-- ==========================================
-- إدارة النظام - System Administration
-- ==========================================
INSERT INTO permissions (module, action, name, description, is_default) VALUES
-- إدارة الصلاحيات
('rbac_management', 'view', 'عرض الصلاحيات', 'عرض نظام الصلاحيات', false),
('rbac_management', 'create', 'إنشاء دور', 'إنشاء دور جديد', false),
('rbac_management', 'edit', 'تعديل الأدوار', 'تعديل الأدوار والصلاحيات', false),
('rbac_management', 'delete', 'حذف الأدوار', 'حذف الأدوار', false),
-- سجلات التدقيق
('audit_logs', 'view', 'عرض سجلات التدقيق', 'عرض سجلات التدقيق', false),
('audit_logs', 'export', 'تصدير سجلات التدقيق', 'تصدير سجلات التدقيق', false),
-- النسخ الاحتياطية
('backups', 'view', 'عرض النسخ الاحتياطية', 'عرض النسخ الاحتياطية', false),
('backups', 'create', 'إنشاء نسخة احتياطية', 'إنشاء نسخة احتياطية', false),
('backups', 'delete', 'حذف نسخة احتياطية', 'حذف النسخ الاحتياطية', false),
-- التكاملات
('integrations', 'view', 'عرض التكاملات', 'عرض التكاملات الخارجية', false),
('integrations', 'create', 'إضافة تكامل', 'إضافة تكامل جديد', false),
('integrations', 'edit', 'تعديل التكامل', 'تعديل التكاملات', false),
('integrations', 'delete', 'حذف التكامل', 'حذف التكاملات', false),
-- التقارير
('reports', 'view', 'عرض التقارير', 'عرض التقارير العامة', true),
('reports', 'create', 'إنشاء تقرير', 'إنشاء تقرير مخصص', false),
('reports', 'export', 'تصدير التقارير', 'تصدير التقارير', false),
('reports', 'print', 'طباعة التقارير', 'طباعة التقارير', false)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Create Default Role Templates
-- ==========================================
INSERT INTO role_templates (name, slug, description, permissions, is_system_default) VALUES
(
  'مدير عام',
  'full_admin',
  'صلاحيات كاملة على جميع وحدات النظام',
  '[
    {"module": "dashboard", "actions": ["view", "export"]},
    {"module": "inventory", "actions": ["view", "create", "edit", "delete", "export", "approve"]},
    {"module": "users", "actions": ["view", "create", "edit", "delete", "change_status"]},
    {"module": "rbac_management", "actions": ["view", "create", "edit", "delete"]},
    {"module": "audit_logs", "actions": ["view", "export"]}
  ]'::jsonb,
  true
),
(
  'مدير فرع',
  'branch_manager',
  'صلاحيات إدارة فرع محدد',
  '[
    {"module": "dashboard", "actions": ["view", "export"]},
    {"module": "inventory", "actions": ["view", "create", "edit", "export"]},
    {"module": "production", "actions": ["view", "create", "edit", "approve"]},
    {"module": "cashier_journal", "actions": ["view", "create", "edit", "approve", "sign"]},
    {"module": "branch_employees", "actions": ["view", "create", "edit", "change_status"]},
    {"module": "attendance", "actions": ["view", "create", "edit", "approve"]}
  ]'::jsonb,
  true
),
(
  'مشرف إنتاج',
  'production_supervisor',
  'صلاحيات قسم الإنتاج',
  '[
    {"module": "production", "actions": ["view", "create", "edit"]},
    {"module": "daily_production", "actions": ["view", "create", "edit"]},
    {"module": "advanced_production", "actions": ["view", "create", "edit"]},
    {"module": "quality_control", "actions": ["view", "create", "edit"]},
    {"module": "products", "actions": ["view"]}
  ]'::jsonb,
  true
),
(
  'كاشير',
  'cashier',
  'صلاحيات الكاشير',
  '[
    {"module": "cashier_journal", "actions": ["view", "create", "sign"]},
    {"module": "cashier_performance", "actions": ["view"]},
    {"module": "targets", "actions": ["view"]}
  ]'::jsonb,
  true
),
(
  'مشاهد فقط',
  'viewer_only',
  'صلاحيات عرض فقط',
  '[
    {"module": "dashboard", "actions": ["view"]},
    {"module": "inventory", "actions": ["view"]},
    {"module": "production", "actions": ["view"]},
    {"module": "reports", "actions": ["view"]}
  ]'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ==========================================
-- Verify Seeding Completed
-- ==========================================
SELECT 
  'Permissions seeded: ' || COUNT(*) as permissions_count
FROM permissions;

SELECT 
  'Role templates seeded: ' || COUNT(*) as templates_count
FROM role_templates;

SELECT 'Permissions Seeding Completed Successfully' as status;
