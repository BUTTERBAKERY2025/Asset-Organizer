-- ==========================================
-- RBAC & Security Enhancement Migration
-- تحسينات نظام الصلاحيات والأمان
-- Execute in Supabase SQL Editor BEFORE deploying
-- ==========================================

-- 1. User Security Settings - إعدادات أمان المستخدم
CREATE TABLE IF NOT EXISTS user_security_settings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  two_factor_secret TEXT,
  two_factor_backup_codes TEXT[],
  ip_whitelist TEXT[],
  ip_restriction_enabled BOOLEAN NOT NULL DEFAULT false,
  session_timeout INTEGER DEFAULT 480,
  max_concurrent_sessions INTEGER DEFAULT 3,
  password_changed_at TIMESTAMP,
  password_expiry_days INTEGER DEFAULT 90,
  force_password_change BOOLEAN NOT NULL DEFAULT false,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP,
  last_login_at TIMESTAMP,
  last_login_ip TEXT,
  last_login_device TEXT,
  trusted_devices JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. User Sessions - جلسات المستخدمين النشطة
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_info JSONB,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);

-- 3. Security Violation Alerts - تنبيهات الانتهاكات الأمنية
CREATE TABLE IF NOT EXISTS security_violation_alerts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  violation_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  module VARCHAR(100),
  action VARCHAR(50),
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by VARCHAR REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_violations_user_id ON security_violation_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_violations_type ON security_violation_alerts(violation_type);
CREATE INDEX IF NOT EXISTS idx_security_violations_created_at ON security_violation_alerts(created_at);

-- 4. Permission Check Logs - سجل فحص الصلاحيات
CREATE TABLE IF NOT EXISTS permission_check_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  resource_id TEXT,
  branch_id VARCHAR REFERENCES branches(id) ON DELETE SET NULL,
  allowed BOOLEAN NOT NULL,
  denial_reason TEXT,
  ip_address TEXT,
  request_path TEXT,
  request_method VARCHAR(10),
  response_time INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perm_check_logs_user_id ON permission_check_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_perm_check_logs_module ON permission_check_logs(module);
CREATE INDEX IF NOT EXISTS idx_perm_check_logs_created_at ON permission_check_logs(created_at);

-- 5. Role Templates - قوالب الأدوار الجاهزة
CREATE TABLE IF NOT EXISTS role_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  is_system_default BOOLEAN NOT NULL DEFAULT false,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ==========================================
-- Seed Default Departments (if not exists)
-- ==========================================
INSERT INTO departments (name, code, description, is_active) VALUES
  ('الإنتاج', 'production', 'قسم الإنتاج والمخبوزات', true),
  ('العمليات', 'operations', 'قسم العمليات والتشغيل', true),
  ('المالية', 'finance', 'قسم المالية والمحاسبة', true),
  ('المبيعات', 'sales', 'قسم المبيعات والكاشير', true),
  ('الموارد البشرية', 'hr', 'قسم الموارد البشرية', true),
  ('الصيانة', 'maintenance', 'قسم الصيانة والأصول', true),
  ('التسويق', 'marketing', 'قسم التسويق', true),
  ('الإدارة', 'administration', 'الإدارة العامة', true),
  ('المشاريع', 'projects', 'قسم المشاريع والإنشاءات', true)
ON CONFLICT (code) DO NOTHING;

-- ==========================================
-- Seed Default Roles (if not exists)
-- ==========================================
INSERT INTO roles (name, slug, hierarchy_level, description, is_system_default) VALUES
  ('المدير العام', 'super_admin', 0, 'صلاحيات كاملة على كل النظام', true),
  ('مدير النظام', 'system_admin', 1, 'إدارة النظام والمستخدمين', true),
  ('مدير الفرع', 'branch_manager', 2, 'إدارة فرع محدد', true),
  ('مشرف القسم', 'department_head', 3, 'إشراف على قسم محدد', true),
  ('موظف', 'employee', 4, 'صلاحيات موظف عادي', true),
  ('مشاهد', 'viewer', 5, 'عرض فقط', true)
ON CONFLICT (slug) DO NOTHING;

-- ==========================================
-- Verify Tables Created
-- ==========================================
SELECT 'RBAC Security Enhancement Migration Completed Successfully' as status;
