-- =====================================================
-- RBAC Complete Permissions Migration
-- Execute in Supabase SQL Editor
-- =====================================================

-- Step 1: Add all missing permissions for new modules
-- Each module gets: view, create, edit, delete, approve, export, print

-- Helper function to insert permission if not exists
DO $$
DECLARE
    modules TEXT[] := ARRAY[
        -- Core (from SYSTEM_MODULES)
        'dashboard', 'platform_home', 'settings',
        -- Inventory & Assets
        'inventory', 'asset_transfers', 'inspections', 'maintenance', 'assets',
        -- Production & Operations
        'production', 'daily_production', 'advanced_production', 'quality_control', 
        'products', 'operations', 'ai_production_planner', 'quality',
        -- Shifts & Attendance
        'shifts', 'attendance', 'timesheet',
        -- HR & Employees
        'users', 'branch_employees', 'branches', 'organizational_structure', 
        'employee_reports', 'employee_transfers', 'hr_management',
        -- Finance
        'cashier', 'cashier_journal', 'cashier_performance', 'pnl_dashboard', 
        'incentives', 'sales_analytics', 'sales_uploads',
        -- Targets & Performance
        'targets', 'targets_planning', 'waste_tracking', 'waste',
        -- Construction
        'construction', 'construction_projects', 'construction_work_items', 
        'construction_reports', 'contractors', 'contracts', 'budget_planning', 
        'payment_requests', 'projects',
        -- Marketing (complete list from SYSTEM_MODULES)
        'marketing', 'marketing_campaigns', 'marketing_influencers', 
        'marketing_tasks', 'marketing_goals', 'marketing_calendar',
        'marketing_alerts', 'marketing_assets', 'marketing_expenses',
        'marketing_reports', 'marketing_team',
        -- System
        'rbac_management', 'audit_logs', 'backups', 'integrations', 'reports'
    ];
    actions TEXT[] := ARRAY['view', 'create', 'edit', 'delete', 'approve', 'export', 'print'];
    m TEXT;
    a TEXT;
    perm_name TEXT;
    perm_desc TEXT;
BEGIN
    FOREACH m IN ARRAY modules LOOP
        FOREACH a IN ARRAY actions LOOP
            perm_name := m || '_' || a;
            perm_desc := 'صلاحية ' || a || ' لوحدة ' || m;
            
            INSERT INTO permissions (module, action, name, description, is_default)
            VALUES (m, a, perm_name, perm_desc, false)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Step 2: Add special permissions for specific modules
INSERT INTO permissions (module, action, name, description, is_default) VALUES
-- Cashier special permissions
('cashier_journal', 'sign', 'cashier_journal_sign', 'التوقيع الإلكتروني على اليومية', false),
('cashier_journal', 'close', 'cashier_journal_close', 'إغلاق اليومية', false),
('cashier_journal', 'reopen', 'cashier_journal_reopen', 'إعادة فتح اليومية', false),

-- Branch employees
('branch_employees', 'transfer', 'branch_employees_transfer', 'تحويل الموظفين بين الفروع', false),
('branch_employees', 'link_user', 'branch_employees_link_user', 'ربط الموظف بحساب مستخدم', false),

-- Employee transfers
('employee_transfers', 'approve', 'employee_transfers_approve', 'اعتماد طلبات النقل', false),
('employee_transfers', 'reject', 'employee_transfers_reject', 'رفض طلبات النقل', false),

-- Construction
('construction_projects', 'change_status', 'construction_projects_change_status', 'تغيير حالة المشروع', false),
('payment_requests', 'approve', 'payment_requests_approve', 'اعتماد طلبات الدفع', false),

-- Production
('production', 'start_shift', 'production_start_shift', 'بدء الوردية', false),
('production', 'end_shift', 'production_end_shift', 'إنهاء الوردية', false),

-- RBAC
('rbac_management', 'assign_roles', 'rbac_management_assign_roles', 'تعيين الأدوار للمستخدمين', false),
('rbac_management', 'manage_permissions', 'rbac_management_manage_permissions', 'إدارة الصلاحيات', false),

-- Attendance
('attendance', 'check_in', 'attendance_check_in', 'تسجيل الحضور', false),
('attendance', 'check_out', 'attendance_check_out', 'تسجيل الانصراف', false),

-- Marketing
('marketing_influencers', 'manage_payments', 'marketing_influencers_manage_payments', 'إدارة مدفوعات المؤثرين', false)

ON CONFLICT DO NOTHING;

-- Step 3: Update role permissions for balanced distribution

-- مدير عام (Super Admin) - All permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, p.id FROM permissions p
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 1 AND rp.permission_id = p.id
);

-- مدير منطقة (Regional Manager) - All except system settings
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, p.id FROM permissions p
WHERE p.module NOT IN ('rbac_management', 'backups', 'integrations')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 2 AND rp.permission_id = p.id
);

-- الإدارة العليا (Senior Management) - View all, manage key areas
INSERT INTO role_permissions (role_id, permission_id)
SELECT 10, p.id FROM permissions p
WHERE (p.action = 'view' OR p.action = 'export' OR p.action = 'print')
   OR (p.module IN ('pnl_dashboard', 'sales_analytics', 'construction_projects', 'marketing_analytics') 
       AND p.action IN ('view', 'create', 'edit', 'approve', 'export'))
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 10 AND rp.permission_id = p.id
);

-- محاسب مالي (Financial Accountant) - Finance modules full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT 9, p.id FROM permissions p
WHERE p.module IN ('cashier', 'cashier_journal', 'cashier_performance', 'pnl_dashboard', 
                   'incentives', 'sales_analytics', 'sales_uploads', 'reports', 'payment_requests')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 9 AND rp.permission_id = p.id
);

-- مدير فرع (Branch Manager) - Full branch operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, p.id FROM permissions p
WHERE p.module IN ('dashboard', 'inventory', 'production', 'daily_production', 'quality_control',
                   'cashier', 'cashier_journal', 'branch_employees', 'shifts', 'attendance',
                   'waste', 'targets', 'operations', 'reports', 'assets', 'maintenance')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 3 AND rp.permission_id = p.id
);

-- مشرف فرع (Branch Supervisor) - Operations supervision
INSERT INTO role_permissions (role_id, permission_id)
SELECT 8, p.id FROM permissions p
WHERE p.module IN ('dashboard', 'production', 'daily_production', 'quality_control',
                   'cashier_journal', 'shifts', 'attendance', 'waste', 'operations')
AND p.action IN ('view', 'create', 'edit', 'export')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 8 AND rp.permission_id = p.id
);

-- مشرف قسم (Department Head) - Department operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, p.id FROM permissions p
WHERE p.module IN ('dashboard', 'inventory', 'production', 'quality_control', 
                   'assets', 'maintenance', 'shifts', 'reports')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 4 AND rp.permission_id = p.id
);

-- كاشير (Cashier) - Cashier operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT 7, p.id FROM permissions p
WHERE (p.module = 'dashboard' AND p.action = 'view')
   OR (p.module = 'cashier_journal' AND p.action IN ('view', 'create', 'edit', 'sign'))
   OR (p.module = 'cashier' AND p.action IN ('view', 'create'))
   OR (p.module = 'attendance' AND p.action IN ('check_in', 'check_out', 'view'))
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 7 AND rp.permission_id = p.id
);

-- موظف (Employee) - Basic operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT 5, p.id FROM permissions p
WHERE (p.action = 'view' AND p.module IN ('dashboard', 'inventory', 'production', 
                                           'shifts', 'attendance', 'quality_control'))
   OR (p.module = 'attendance' AND p.action IN ('check_in', 'check_out'))
   OR (p.module IN ('production', 'inventory') AND p.action IN ('create', 'edit'))
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 5 AND rp.permission_id = p.id
);

-- مشاهد (Viewer) - View only
INSERT INTO role_permissions (role_id, permission_id)
SELECT 6, p.id FROM permissions p
WHERE p.action = 'view'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 6 AND rp.permission_id = p.id
);

-- Step 4: Verify the results
SELECT 'Total Permissions' as metric, COUNT(*)::text as value FROM permissions
UNION ALL
SELECT 'Modules with Permissions', COUNT(DISTINCT module)::text FROM permissions
UNION ALL
SELECT 'Super Admin Permissions', COUNT(*)::text FROM role_permissions WHERE role_id = 1
UNION ALL
SELECT 'Branch Manager Permissions', COUNT(*)::text FROM role_permissions WHERE role_id = 3
UNION ALL
SELECT 'Cashier Permissions', COUNT(*)::text FROM role_permissions WHERE role_id = 7;
