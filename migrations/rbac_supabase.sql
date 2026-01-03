-- ============================================================
-- RBAC System Migration for Supabase
-- نظام التحكم بالوصول المبني على الأدوار
-- ============================================================
-- Run this SQL in Supabase SQL Editor before deploying the code
-- ============================================================

-- 1. Departments Table (الأقسام)
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 2. Roles Table (الأدوار)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  hierarchy_level INTEGER DEFAULT 0 NOT NULL,
  description TEXT,
  is_system_default BOOLEAN DEFAULT FALSE NOT NULL,
  inherits_from_role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3. Permissions Table (الصلاحيات)
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  module VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 4. Role Permissions Table (صلاحيات الأدوار)
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  scope JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(role_id, permission_id)
);

-- 5. User Assignments Table (تعيينات المستخدمين)
CREATE TABLE IF NOT EXISTS user_assignments (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  branch_id VARCHAR REFERENCES branches(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  scope_type VARCHAR(20) DEFAULT 'branch' NOT NULL,
  is_primary BOOLEAN DEFAULT TRUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 6. User Permission Overrides Table (تجاوزات الصلاحيات)
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  allow BOOLEAN NOT NULL,
  branch_id VARCHAR REFERENCES branches(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  reason TEXT,
  granted_by VARCHAR REFERENCES users(id),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 7. User Branch Access Table (صلاحيات الفروع للمستخدمين)
CREATE TABLE IF NOT EXISTS user_branch_access (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  access_level VARCHAR(20) DEFAULT 'full' NOT NULL,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, branch_id)
);

-- ============================================================
-- SEED DATA - البيانات الأولية
-- ============================================================

-- Insert Departments (الأقسام)
INSERT INTO departments (name, code, description, is_active) VALUES
  ('الإنتاج', 'production', 'قسم الإنتاج والتصنيع', true),
  ('العمليات', 'operations', 'قسم العمليات والتشغيل', true),
  ('المالية', 'finance', 'قسم المالية والمحاسبة', true),
  ('المبيعات', 'sales', 'قسم المبيعات والكاشير', true),
  ('الموارد البشرية', 'hr', 'قسم الموارد البشرية', true),
  ('الصيانة', 'maintenance', 'قسم الصيانة والأصول', true),
  ('الإدارة', 'administration', 'الإدارة العامة', true)
ON CONFLICT (code) DO NOTHING;

-- Insert Roles (الأدوار)
INSERT INTO roles (name, slug, hierarchy_level, description, is_system_default) VALUES
  ('مدير عام', 'super_admin', 0, 'صلاحيات كاملة على جميع الفروع والأقسام', true),
  ('مدير فرع', 'branch_manager', 1, 'إدارة فرع محدد بجميع أقسامه', true),
  ('مشرف قسم', 'department_head', 2, 'إدارة قسم محدد في فرع أو أكثر', true),
  ('موظف', 'employee', 3, 'صلاحيات تشغيلية محددة', true),
  ('مستخدم', 'user', 4, 'صلاحيات أساسية محدودة', true),
  ('مشاهد', 'viewer', 5, 'عرض فقط بدون تعديل', true)
ON CONFLICT (slug) DO NOTHING;

-- Insert Permissions (الصلاحيات)
INSERT INTO permissions (module, action, name, description, is_default) VALUES
  -- Dashboard
  ('dashboard', 'view', 'عرض لوحة التحكم', 'الوصول للوحة التحكم الرئيسية', true),
  
  -- Inventory
  ('inventory', 'view', 'عرض المخزون', 'عرض عناصر المخزون', true),
  ('inventory', 'create', 'إضافة للمخزون', 'إضافة عناصر جديدة للمخزون', false),
  ('inventory', 'edit', 'تعديل المخزون', 'تعديل بيانات المخزون', false),
  ('inventory', 'delete', 'حذف من المخزون', 'حذف عناصر من المخزون', false),
  ('inventory', 'export', 'تصدير المخزون', 'تصدير بيانات المخزون', false),
  
  -- Production
  ('production', 'view', 'عرض الإنتاج', 'عرض أوامر وتقارير الإنتاج', true),
  ('production', 'create', 'إنشاء أمر إنتاج', 'إنشاء أوامر إنتاج جديدة', false),
  ('production', 'edit', 'تعديل الإنتاج', 'تعديل أوامر الإنتاج', false),
  ('production', 'delete', 'حذف أمر إنتاج', 'حذف أوامر الإنتاج', false),
  ('production', 'approve', 'اعتماد الإنتاج', 'اعتماد أوامر الإنتاج', false),
  ('production', 'export', 'تصدير تقارير الإنتاج', 'تصدير تقارير الإنتاج', false),
  
  -- Cashier
  ('cashier', 'view', 'عرض الكاشير', 'عرض يوميات الكاشير', true),
  ('cashier', 'create', 'إنشاء يومية', 'إنشاء يومية كاشير جديدة', false),
  ('cashier', 'edit', 'تعديل اليومية', 'تعديل يومية الكاشير', false),
  ('cashier', 'delete', 'حذف اليومية', 'حذف يومية الكاشير', false),
  ('cashier', 'approve', 'اعتماد اليومية', 'اعتماد يومية الكاشير', false),
  ('cashier', 'export', 'تصدير الكاشير', 'تصدير تقارير الكاشير', false),
  
  -- Quality
  ('quality', 'view', 'عرض الجودة', 'عرض فحوصات الجودة', true),
  ('quality', 'create', 'إنشاء فحص جودة', 'إنشاء فحوصات جودة جديدة', false),
  ('quality', 'edit', 'تعديل فحص الجودة', 'تعديل فحوصات الجودة', false),
  ('quality', 'approve', 'اعتماد فحص الجودة', 'اعتماد نتائج فحص الجودة', false),
  
  -- Waste
  ('waste', 'view', 'عرض الهدر', 'عرض تقارير الهدر', true),
  ('waste', 'create', 'تسجيل هدر', 'تسجيل حالات هدر جديدة', false),
  ('waste', 'edit', 'تعديل الهدر', 'تعديل بيانات الهدر', false),
  ('waste', 'delete', 'حذف الهدر', 'حذف سجلات الهدر', false),
  ('waste', 'export', 'تصدير الهدر', 'تصدير تقارير الهدر', false),
  
  -- Targets
  ('targets', 'view', 'عرض الأهداف', 'عرض الأهداف والخطط', true),
  ('targets', 'create', 'إنشاء هدف', 'إنشاء أهداف جديدة', false),
  ('targets', 'edit', 'تعديل الأهداف', 'تعديل الأهداف', false),
  ('targets', 'delete', 'حذف هدف', 'حذف الأهداف', false),
  
  -- Reports
  ('reports', 'view', 'عرض التقارير', 'عرض التقارير العامة', true),
  ('reports', 'export', 'تصدير التقارير', 'تصدير التقارير بصيغ مختلفة', false),
  ('reports', 'print', 'طباعة التقارير', 'طباعة التقارير', false),
  
  -- Users
  ('users', 'view', 'عرض المستخدمين', 'عرض قائمة المستخدمين', false),
  ('users', 'create', 'إنشاء مستخدم', 'إضافة مستخدمين جدد', false),
  ('users', 'edit', 'تعديل المستخدمين', 'تعديل بيانات المستخدمين', false),
  ('users', 'delete', 'حذف مستخدم', 'حذف المستخدمين', false),
  
  -- Branches
  ('branches', 'view', 'عرض الفروع', 'عرض قائمة الفروع', true),
  ('branches', 'create', 'إنشاء فرع', 'إضافة فروع جديدة', false),
  ('branches', 'edit', 'تعديل الفروع', 'تعديل بيانات الفروع', false),
  ('branches', 'delete', 'حذف فرع', 'حذف الفروع', false),
  
  -- Construction
  ('construction', 'view', 'عرض المشاريع', 'عرض المشاريع الإنشائية', true),
  ('construction', 'create', 'إنشاء مشروع', 'إنشاء مشاريع جديدة', false),
  ('construction', 'edit', 'تعديل المشاريع', 'تعديل المشاريع الإنشائية', false),
  ('construction', 'delete', 'حذف مشروع', 'حذف المشاريع', false),
  ('construction', 'approve', 'اعتماد المشاريع', 'اعتماد المشاريع والدفعات', false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Assign Permissions to Roles (ربط الصلاحيات بالأدوار)
-- ============================================================

-- Super Admin - جميع الصلاحيات
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Branch Manager - معظم الصلاحيات ماعدا إدارة المستخدمين والفروع
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'branch_manager' 
  AND p.module NOT IN ('users', 'branches')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Department Head - صلاحيات القسم + العرض العام
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'department_head' 
  AND (p.action IN ('view', 'create', 'edit', 'export') AND p.module NOT IN ('users', 'branches'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Employee - صلاحيات تشغيلية
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'employee' 
  AND p.action IN ('view', 'create')
  AND p.module NOT IN ('users', 'branches', 'targets')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- User - صلاحيات أساسية
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'user' 
  AND p.action = 'view'
  AND p.module IN ('dashboard', 'inventory', 'production', 'cashier', 'branches')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer - عرض فقط
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'viewer' 
  AND p.action = 'view'
  AND p.is_default = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- Create Indexes for Performance (فهارس للأداء)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_assignments_user_id ON user_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assignments_role_id ON user_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_user_assignments_branch_id ON user_assignments(branch_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_id ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_user_id ON user_branch_access(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

-- ============================================================
-- DONE! نظام RBAC جاهز للاستخدام
-- ============================================================
