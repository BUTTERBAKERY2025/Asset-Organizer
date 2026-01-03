-- ==================== نظام الصلاحيات والمستخدمين الشامل ====================
-- هذا الملف يجب تشغيله في Supabase SQL Editor قبل النشر

-- 1. جدول الأقسام
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 2. جدول الأدوار
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_system_default BOOLEAN NOT NULL DEFAULT false,
  inherits_from_role_id INTEGER REFERENCES roles(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3. جدول الصلاحيات
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  module VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 4. جدول صلاحيات الأدوار
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  scope JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 5. جدول تعيينات المستخدمين
CREATE TABLE IF NOT EXISTS user_assignments (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  branch_id VARCHAR REFERENCES branches(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  scope_type VARCHAR(20) NOT NULL DEFAULT 'branch',
  is_primary BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 6. جدول تجاوزات صلاحيات المستخدم
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

-- 7. جدول وصول المستخدم للفروع
CREATE TABLE IF NOT EXISTS user_branch_access (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  access_level VARCHAR(20) NOT NULL DEFAULT 'full',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ==================== البيانات الأساسية ====================

-- إدراج الأقسام الأساسية
INSERT INTO departments (name, code, description) VALUES
  ('الإدارة العامة', 'management', 'الإدارة العليا والمديرين'),
  ('الإنتاج', 'production', 'قسم الإنتاج والمخابز'),
  ('المخزون', 'inventory', 'إدارة المخزون والمستودعات'),
  ('الكاشير', 'cashier', 'نقاط البيع والمحاسبة'),
  ('الصيانة', 'maintenance', 'صيانة المعدات والأصول'),
  ('المشاريع', 'projects', 'إدارة مشاريع البناء والتطوير'),
  ('الجودة', 'quality', 'مراقبة الجودة')
ON CONFLICT (code) DO NOTHING;

-- إدراج الأدوار الأساسية
INSERT INTO roles (name, slug, hierarchy_level, description, is_system_default) VALUES
  ('مدير عام', 'super_admin', 0, 'صلاحيات كاملة على النظام بأكمله', true),
  ('مدير منطقة', 'regional_manager', 1, 'إدارة عدة فروع في منطقة', true),
  ('مدير فرع', 'branch_manager', 2, 'إدارة فرع واحد بالكامل', true),
  ('مشرف قسم', 'department_head', 3, 'إشراف على قسم معين في فرع', true),
  ('موظف', 'employee', 4, 'موظف عادي مع صلاحيات محدودة', true),
  ('مشاهد', 'viewer', 5, 'عرض البيانات فقط دون تعديل', true)
ON CONFLICT (slug) DO NOTHING;

-- إدراج الصلاحيات الأساسية لكل وحدة
INSERT INTO permissions (module, action, name, description, is_default) VALUES
  -- لوحة التحكم
  ('dashboard', 'view', 'عرض لوحة التحكم', 'مشاهدة الصفحة الرئيسية ولوحة التحكم', true),
  
  -- إدارة المخزون
  ('inventory', 'view', 'عرض المخزون', 'مشاهدة قائمة المخزون', true),
  ('inventory', 'create', 'إضافة صنف', 'إضافة أصناف جديدة للمخزون', false),
  ('inventory', 'edit', 'تعديل صنف', 'تعديل بيانات الأصناف', false),
  ('inventory', 'delete', 'حذف صنف', 'حذف أصناف من المخزون', false),
  ('inventory', 'export', 'تصدير المخزون', 'تصدير بيانات المخزون', false),
  ('inventory', 'transfer', 'تحويل بين الفروع', 'تحويل أصناف بين الفروع', false),
  
  -- إدارة الإنتاج
  ('production', 'view', 'عرض الإنتاج', 'مشاهدة بيانات الإنتاج', true),
  ('production', 'create', 'تسجيل إنتاج', 'تسجيل دفعات إنتاج جديدة', false),
  ('production', 'edit', 'تعديل إنتاج', 'تعديل بيانات الإنتاج', false),
  ('production', 'delete', 'حذف إنتاج', 'حذف سجلات الإنتاج', false),
  ('production', 'approve', 'اعتماد الإنتاج', 'اعتماد طلبات الإنتاج', false),
  ('production', 'export', 'تصدير تقارير الإنتاج', 'تصدير تقارير الإنتاج', false),
  
  -- يوميات الكاشير
  ('cashier', 'view', 'عرض الكاشير', 'مشاهدة يوميات الكاشير', true),
  ('cashier', 'create', 'إنشاء يومية', 'إنشاء يومية كاشير جديدة', false),
  ('cashier', 'edit', 'تعديل يومية', 'تعديل يوميات الكاشير', false),
  ('cashier', 'approve', 'اعتماد اليومية', 'اعتماد يوميات الكاشير', false),
  ('cashier', 'export', 'تصدير اليوميات', 'تصدير يوميات الكاشير', false),
  
  -- إدارة الهالك
  ('waste', 'view', 'عرض الهالك', 'مشاهدة تقارير الهالك', true),
  ('waste', 'create', 'تسجيل هالك', 'تسجيل منتجات هالكة', false),
  ('waste', 'edit', 'تعديل هالك', 'تعديل تقارير الهالك', false),
  ('waste', 'approve', 'اعتماد الهالك', 'اعتماد تقارير الهالك', false),
  
  -- إدارة الأصول
  ('assets', 'view', 'عرض الأصول', 'مشاهدة قائمة الأصول', true),
  ('assets', 'create', 'إضافة أصل', 'إضافة أصول جديدة', false),
  ('assets', 'edit', 'تعديل أصل', 'تعديل بيانات الأصول', false),
  ('assets', 'delete', 'حذف أصل', 'حذف أصول', false),
  ('assets', 'maintenance', 'جدولة الصيانة', 'جدولة صيانة الأصول', false),
  
  -- إدارة المشاريع
  ('projects', 'view', 'عرض المشاريع', 'مشاهدة المشاريع', true),
  ('projects', 'create', 'إنشاء مشروع', 'إنشاء مشاريع جديدة', false),
  ('projects', 'edit', 'تعديل مشروع', 'تعديل بيانات المشاريع', false),
  ('projects', 'approve', 'اعتماد المشروع', 'اعتماد المشاريع', false),
  
  -- مراقبة الجودة
  ('quality', 'view', 'عرض الجودة', 'مشاهدة تقارير الجودة', true),
  ('quality', 'create', 'تسجيل فحص', 'تسجيل فحوصات الجودة', false),
  ('quality', 'approve', 'اعتماد الجودة', 'اعتماد تقارير الجودة', false),
  
  -- التقارير
  ('reports', 'view', 'عرض التقارير', 'مشاهدة التقارير', true),
  ('reports', 'export', 'تصدير التقارير', 'تصدير التقارير بصيغ مختلفة', false),
  ('reports', 'advanced', 'تقارير متقدمة', 'الوصول للتقارير التحليلية المتقدمة', false),
  
  -- إدارة المستخدمين
  ('users', 'view', 'عرض المستخدمين', 'مشاهدة قائمة المستخدمين', false),
  ('users', 'create', 'إضافة مستخدم', 'إضافة مستخدمين جدد', false),
  ('users', 'edit', 'تعديل مستخدم', 'تعديل بيانات المستخدمين', false),
  ('users', 'delete', 'حذف مستخدم', 'حذف المستخدمين', false),
  ('users', 'permissions', 'إدارة الصلاحيات', 'تعديل صلاحيات المستخدمين', false),
  
  -- إدارة الفروع
  ('branches', 'view', 'عرض الفروع', 'مشاهدة قائمة الفروع', true),
  ('branches', 'create', 'إضافة فرع', 'إضافة فروع جديدة', false),
  ('branches', 'edit', 'تعديل فرع', 'تعديل بيانات الفروع', false),
  
  -- إعدادات النظام
  ('settings', 'view', 'عرض الإعدادات', 'مشاهدة إعدادات النظام', false),
  ('settings', 'edit', 'تعديل الإعدادات', 'تعديل إعدادات النظام', false)
ON CONFLICT DO NOTHING;

-- ربط صلاحيات المدير العام (جميع الصلاحيات)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, '{"branches": ["all"], "departments": ["all"]}'::jsonb
FROM roles r, permissions p
WHERE r.slug = 'super_admin'
ON CONFLICT DO NOTHING;

-- ربط صلاحيات المشاهد (العرض فقط)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, NULL
FROM roles r, permissions p
WHERE r.slug = 'viewer' AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- ربط صلاحيات الموظف (عرض + إنشاء أساسي)
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, NULL
FROM roles r, permissions p
WHERE r.slug = 'employee' AND (p.action = 'view' OR (p.action = 'create' AND p.module IN ('production', 'waste', 'cashier')))
ON CONFLICT DO NOTHING;

-- ربط صلاحيات مشرف القسم
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, NULL
FROM roles r, permissions p
WHERE r.slug = 'department_head' AND p.action IN ('view', 'create', 'edit', 'approve', 'export')
ON CONFLICT DO NOTHING;

-- ربط صلاحيات مدير الفرع
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, NULL
FROM roles r, permissions p
WHERE r.slug = 'branch_manager' AND p.action IN ('view', 'create', 'edit', 'delete', 'approve', 'export')
ON CONFLICT DO NOTHING;

-- ربط صلاحيات مدير المنطقة
INSERT INTO role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, NULL
FROM roles r, permissions p
WHERE r.slug = 'regional_manager'
ON CONFLICT DO NOTHING;

-- ==================== إنشاء الفهارس ====================
CREATE INDEX IF NOT EXISTS idx_user_assignments_user_id ON user_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assignments_role_id ON user_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_user_assignments_branch_id ON user_assignments(branch_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_user_id ON user_branch_access(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_module_action ON permissions(module, action);
