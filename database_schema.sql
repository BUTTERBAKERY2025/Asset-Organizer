-- =====================================================
-- نظام إدارة المشروعات والأصول والصيانة - باتر
-- مخطط قاعدة البيانات الكامل
-- تاريخ التحديث: 2026-01-05
-- =====================================================

-- تفعيل UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. جدول الجلسات (للمصادقة)
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions(expire);

-- =====================================================
-- 2. جدول الفروع
-- =====================================================
CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 3. جدول المستخدمين
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR UNIQUE,
    password VARCHAR,
    phone VARCHAR,
    email VARCHAR,
    first_name VARCHAR,
    last_name VARCHAR,
    profile_image_url VARCHAR,
    role VARCHAR DEFAULT 'viewer' NOT NULL,
    branch_id VARCHAR REFERENCES branches(id),
    job_title VARCHAR,
    is_active TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =====================================================
-- 4. جدول عناصر المخزون
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_items (
    id VARCHAR PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL,
    status TEXT,
    last_check TEXT,
    notes TEXT,
    serial_number TEXT,
    image_url TEXT,
    next_inspection_date TEXT,
    inspection_interval_days INTEGER,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status);

-- =====================================================
-- 5. جدول سجلات التدقيق (للمخزون)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 6. جدول سجلات التدقيق على مستوى النظام
-- =====================================================
CREATE TABLE IF NOT EXISTS system_audit_logs (
    id SERIAL PRIMARY KEY,
    module TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_name TEXT,
    action TEXT NOT NULL,
    details TEXT,
    user_id VARCHAR REFERENCES users(id),
    user_name TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 7. جدول النسخ الاحتياطية
-- =====================================================
CREATE TABLE IF NOT EXISTS backups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    file_size INTEGER,
    file_path TEXT,
    tables TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMP
);

-- =====================================================
-- 8. جدول الفلاتر المحفوظة
-- =====================================================
CREATE TABLE IF NOT EXISTS saved_filters (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    filter_config TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 9. جدول فئات الإنشاءات
-- =====================================================
CREATE TABLE IF NOT EXISTS construction_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 10. جدول المقاولين
-- =====================================================
CREATE TABLE IF NOT EXISTS contractors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    specialization TEXT,
    notes TEXT,
    rating INTEGER,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 11. جدول مشاريع الإنشاءات
-- =====================================================
CREATE TABLE IF NOT EXISTS construction_projects (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'planned' NOT NULL,
    budget REAL,
    actual_cost REAL,
    start_date TEXT,
    target_completion_date TEXT,
    actual_completion_date TEXT,
    progress_percent INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_branch ON construction_projects(branch_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON construction_projects(status);

-- =====================================================
-- 12. جدول بنود أعمال المشاريع
-- =====================================================
CREATE TABLE IF NOT EXISTS project_work_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES construction_categories(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    cost_estimate REAL,
    actual_cost REAL,
    contractor_id INTEGER REFERENCES contractors(id),
    scheduled_start TEXT,
    scheduled_end TEXT,
    completed_at TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_work_items_project ON project_work_items(project_id);
CREATE INDEX IF NOT EXISTS idx_work_items_status ON project_work_items(status);

-- =====================================================
-- 13. جدول تخصيصات ميزانية المشاريع
-- =====================================================
CREATE TABLE IF NOT EXISTS project_budget_allocations (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES construction_categories(id),
    planned_amount REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 14. جدول عقود الإنشاءات
-- =====================================================
CREATE TABLE IF NOT EXISTS construction_contracts (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
    contractor_id INTEGER NOT NULL REFERENCES contractors(id),
    contract_number TEXT UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    contract_type TEXT DEFAULT 'fixed_price' NOT NULL,
    status TEXT DEFAULT 'draft' NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    payment_terms TEXT,
    warranty_period TEXT,
    notes TEXT,
    attachment_url TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 15. جدول بنود العقود
-- =====================================================
CREATE TABLE IF NOT EXISTS contract_items (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES construction_contracts(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES construction_categories(id),
    description TEXT NOT NULL,
    unit TEXT DEFAULT 'قطعة',
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    completed_quantity REAL DEFAULT 0,
    status TEXT DEFAULT 'pending' NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 16. جدول طلبات الدفع
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_requests (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
    contract_id INTEGER REFERENCES construction_contracts(id),
    request_number TEXT,
    request_type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    beneficiary_name TEXT,
    beneficiary_bank TEXT,
    beneficiary_iban TEXT,
    category_id INTEGER REFERENCES construction_categories(id),
    status TEXT DEFAULT 'pending' NOT NULL,
    priority TEXT DEFAULT 'normal',
    request_date TEXT,
    due_date TEXT,
    approved_by VARCHAR REFERENCES users(id),
    approved_at TIMESTAMP,
    paid_at TIMESTAMP,
    rejection_reason TEXT,
    attachment_url TEXT,
    invoice_number TEXT,
    notes TEXT,
    requested_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 17. جدول دفعات العقود
-- =====================================================
CREATE TABLE IF NOT EXISTS contract_payments (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES construction_contracts(id) ON DELETE CASCADE,
    payment_request_id INTEGER REFERENCES payment_requests(id),
    amount REAL NOT NULL,
    payment_date TEXT NOT NULL,
    payment_method TEXT,
    reference_number TEXT,
    notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 18. جدول صلاحيات المستخدمين
-- =====================================================
CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    actions TEXT[] NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 19. جدول صلاحيات الوظائف
-- =====================================================
CREATE TABLE IF NOT EXISTS job_role_permissions (
    id SERIAL PRIMARY KEY,
    job_title TEXT NOT NULL,
    module TEXT NOT NULL,
    actions TEXT[] NOT NULL,
    is_default BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 20. جدول سجلات تغييرات الصلاحيات
-- =====================================================
CREATE TABLE IF NOT EXISTS permission_audit_logs (
    id SERIAL PRIMARY KEY,
    target_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    changed_by_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    module TEXT,
    old_actions TEXT[],
    new_actions TEXT[],
    template_applied TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 21. جدول تحويلات الأصول
-- =====================================================
CREATE TABLE IF NOT EXISTS asset_transfers (
    id SERIAL PRIMARY KEY,
    transfer_number TEXT NOT NULL UNIQUE,
    item_id VARCHAR NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    from_branch_id VARCHAR NOT NULL REFERENCES branches(id),
    to_branch_id VARCHAR NOT NULL REFERENCES branches(id),
    status TEXT DEFAULT 'pending' NOT NULL,
    reason TEXT,
    notes TEXT,
    requested_by VARCHAR REFERENCES users(id),
    requested_at TIMESTAMP DEFAULT NOW() NOT NULL,
    approved_by VARCHAR REFERENCES users(id),
    approved_at TIMESTAMP,
    received_by VARCHAR REFERENCES users(id),
    received_at TIMESTAMP,
    receiver_name TEXT,
    receiver_signature TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 22. جدول أحداث تحويل الأصول
-- =====================================================
CREATE TABLE IF NOT EXISTS asset_transfer_events (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL REFERENCES asset_transfers(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id VARCHAR REFERENCES users(id),
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 23. جدول التكاملات الخارجية
-- =====================================================
CREATE TABLE IF NOT EXISTS external_integrations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config JSONB,
    is_active TEXT DEFAULT 'true',
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 24. جدول قوالب الإشعارات
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    channel TEXT NOT NULL,
    template TEXT NOT NULL,
    is_active TEXT DEFAULT 'true',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 25. جدول طابور الإشعارات
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_queue (
    id SERIAL PRIMARY KEY,
    recipient_phone TEXT NOT NULL,
    recipient_name TEXT,
    channel TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    error_message TEXT,
    related_module TEXT,
    related_entity_id TEXT,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 26. جدول وظائف استيراد البيانات
-- =====================================================
CREATE TABLE IF NOT EXISTS data_import_jobs (
    id SERIAL PRIMARY KEY,
    source_system TEXT NOT NULL,
    target_module TEXT NOT NULL,
    file_name TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    error_log TEXT,
    imported_by VARCHAR REFERENCES users(id),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 27. جدول تصديرات المحاسبة
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_exports (
    id SERIAL PRIMARY KEY,
    export_type TEXT NOT NULL,
    date_from TEXT,
    date_to TEXT,
    branch_id VARCHAR REFERENCES branches(id),
    data JSONB,
    status TEXT DEFAULT 'pending' NOT NULL,
    synced_at TIMESTAMP,
    exported_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 28. جدول المنتجات
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT NOT NULL,
    unit TEXT DEFAULT 'قطعة',
    base_price DOUBLE PRECISION,
    price_excl_vat DOUBLE PRECISION,
    vat_amount DOUBLE PRECISION,
    vat_rate DOUBLE PRECISION DEFAULT 0.15,
    is_active TEXT DEFAULT 'true',
    description TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 29. جدول الورديات
-- =====================================================
CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled' NOT NULL,
    supervisor_name TEXT,
    employee_count INTEGER DEFAULT 0,
    notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 30. جدول موظفي الوردية
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_employees (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    role TEXT,
    check_in_time TEXT,
    check_out_time TEXT,
    status TEXT DEFAULT 'expected' NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 31. جدول أوامر الإنتاج
-- =====================================================
CREATE TABLE IF NOT EXISTS production_orders (
    id SERIAL PRIMARY KEY,
    order_number TEXT UNIQUE,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    shift_id INTEGER REFERENCES shifts(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    target_quantity INTEGER NOT NULL,
    produced_quantity INTEGER DEFAULT 0,
    wasted_quantity INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' NOT NULL,
    priority TEXT DEFAULT 'normal',
    scheduled_date TEXT,
    scheduled_time TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    assigned_to TEXT,
    notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 32. جدول فحوصات الجودة
-- =====================================================
CREATE TABLE IF NOT EXISTS quality_checks (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    shift_id INTEGER REFERENCES shifts(id),
    production_order_id INTEGER REFERENCES production_orders(id),
    check_type TEXT NOT NULL,
    check_date TEXT NOT NULL,
    check_time TEXT,
    result TEXT NOT NULL,
    score INTEGER,
    temperature REAL,
    checked_by TEXT NOT NULL,
    details TEXT,
    issues TEXT,
    corrective_action TEXT,
    attachment_url TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 33. جدول ملخص العمليات اليومية
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_operations_summary (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    total_produced INTEGER DEFAULT 0,
    total_wasted INTEGER DEFAULT 0,
    waste_percentage REAL DEFAULT 0,
    quality_score REAL,
    shifts_count INTEGER DEFAULT 0,
    employees_present INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 34. جدول يوميات مبيعات الكاشير
-- =====================================================
CREATE TABLE IF NOT EXISTS cashier_sales_journals (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    shift_id INTEGER REFERENCES shifts(id),
    cashier_id VARCHAR NOT NULL REFERENCES users(id),
    cashier_name TEXT NOT NULL,
    journal_date TEXT NOT NULL,
    shift_type TEXT,
    shift_start_time TEXT,
    shift_end_time TEXT,
    opening_balance REAL DEFAULT 0 NOT NULL,
    total_sales REAL DEFAULT 0 NOT NULL,
    cash_total REAL DEFAULT 0 NOT NULL,
    network_total REAL DEFAULT 0 NOT NULL,
    delivery_total REAL DEFAULT 0 NOT NULL,
    expected_cash REAL DEFAULT 0 NOT NULL,
    actual_cash_drawer REAL DEFAULT 0 NOT NULL,
    discrepancy_amount REAL DEFAULT 0 NOT NULL,
    discrepancy_status TEXT DEFAULT 'balanced' NOT NULL,
    customer_count INTEGER DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    average_ticket REAL DEFAULT 0,
    status TEXT DEFAULT 'draft' NOT NULL,
    submitted_at TIMESTAMP,
    approved_by VARCHAR REFERENCES users(id),
    approved_at TIMESTAMP,
    notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_journals_branch_date ON cashier_sales_journals(branch_id, journal_date);
CREATE INDEX IF NOT EXISTS idx_journals_cashier ON cashier_sales_journals(cashier_id);
CREATE INDEX IF NOT EXISTS idx_journals_status ON cashier_sales_journals(status);

-- =====================================================
-- 35. جدول تفصيل المدفوعات
-- =====================================================
CREATE TABLE IF NOT EXISTS cashier_payment_breakdowns (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER NOT NULL REFERENCES cashier_sales_journals(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL,
    amount REAL DEFAULT 0 NOT NULL,
    transaction_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 36. جدول توقيعات الكاشير
-- =====================================================
CREATE TABLE IF NOT EXISTS cashier_signatures (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER NOT NULL REFERENCES cashier_sales_journals(id) ON DELETE CASCADE,
    signature_type TEXT NOT NULL,
    signer_name TEXT NOT NULL,
    signer_id VARCHAR REFERENCES users(id),
    signature_data TEXT NOT NULL,
    signed_at TIMESTAMP DEFAULT NOW() NOT NULL,
    ip_address TEXT,
    notes TEXT
);

-- =====================================================
-- 37. جدول مرفقات اليومية
-- =====================================================
CREATE TABLE IF NOT EXISTS journal_attachments (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER NOT NULL REFERENCES cashier_sales_journals(id) ON DELETE CASCADE,
    attachment_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_data TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER,
    notes TEXT,
    uploaded_by VARCHAR REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 38. جدول ملفات توزيع أوزان الأهداف
-- =====================================================
CREATE TABLE IF NOT EXISTS target_weight_profiles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    sunday_weight REAL DEFAULT 100 NOT NULL,
    monday_weight REAL DEFAULT 100 NOT NULL,
    tuesday_weight REAL DEFAULT 100 NOT NULL,
    wednesday_weight REAL DEFAULT 100 NOT NULL,
    thursday_weight REAL DEFAULT 130 NOT NULL,
    friday_weight REAL DEFAULT 130 NOT NULL,
    saturday_weight REAL DEFAULT 100 NOT NULL,
    seasonal_adjustments JSONB,
    holiday_overrides JSONB,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 39. جدول الأهداف الشهرية للفروع
-- =====================================================
CREATE TABLE IF NOT EXISTS branch_monthly_targets (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    year_month TEXT NOT NULL,
    target_amount REAL NOT NULL,
    profile_id INTEGER REFERENCES target_weight_profiles(id),
    status TEXT DEFAULT 'draft' NOT NULL,
    notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    approved_by VARCHAR REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 40. جدول توزيع الأهداف اليومية
-- =====================================================
CREATE TABLE IF NOT EXISTS target_daily_allocations (
    id SERIAL PRIMARY KEY,
    monthly_target_id INTEGER NOT NULL REFERENCES branch_monthly_targets(id) ON DELETE CASCADE,
    target_date TEXT NOT NULL,
    weight_percent REAL NOT NULL,
    daily_target REAL NOT NULL,
    is_holiday BOOLEAN DEFAULT FALSE,
    is_manual_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 41. جدول توزيع الأهداف على الورديات
-- =====================================================
CREATE TABLE IF NOT EXISTS target_shift_allocations (
    id SERIAL PRIMARY KEY,
    daily_allocation_id INTEGER NOT NULL REFERENCES target_daily_allocations(id) ON DELETE CASCADE,
    shift_type TEXT NOT NULL,
    shift_target REAL NOT NULL,
    shift_weight_percent REAL NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 42. جدول مستويات الحوافز
-- =====================================================
CREATE TABLE IF NOT EXISTS incentive_tiers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    min_achievement_percent REAL NOT NULL,
    max_achievement_percent REAL,
    reward_type TEXT NOT NULL,
    fixed_amount REAL,
    percentage_rate REAL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    applicable_to TEXT DEFAULT 'all' NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 43. جدول المكافآت والحوافز
-- =====================================================
CREATE TABLE IF NOT EXISTS incentive_awards (
    id SERIAL PRIMARY KEY,
    award_type TEXT NOT NULL,
    branch_id VARCHAR REFERENCES branches(id),
    cashier_id VARCHAR REFERENCES users(id),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    target_amount REAL NOT NULL,
    achieved_amount REAL NOT NULL,
    achievement_percent REAL NOT NULL,
    tier_id INTEGER REFERENCES incentive_tiers(id),
    calculated_reward REAL NOT NULL,
    adjusted_reward REAL,
    final_reward REAL NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    notes TEXT,
    journal_ids JSONB,
    approved_by VARCHAR REFERENCES users(id),
    approved_at TIMESTAMP,
    paid_at TIMESTAMP,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 44. جدول المواسم والإجازات
-- =====================================================
CREATE TABLE IF NOT EXISTS seasons_holidays (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    color TEXT DEFAULT '#f59e0b',
    icon TEXT,
    weight_multiplier REAL DEFAULT 1.0 NOT NULL,
    applicable_branches JSONB,
    description TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_pattern TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 45. جدول معدلات العمولات
-- =====================================================
CREATE TABLE IF NOT EXISTS commission_rates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    min_sales_amount REAL DEFAULT 0,
    max_sales_amount REAL,
    commission_type TEXT NOT NULL,
    fixed_amount REAL,
    percentage_rate REAL,
    applicable_to TEXT DEFAULT 'cashier' NOT NULL,
    applicable_branches JSONB,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    valid_from TEXT,
    valid_to TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 46. جدول حسابات العمولات
-- =====================================================
CREATE TABLE IF NOT EXISTS commission_calculations (
    id SERIAL PRIMARY KEY,
    cashier_id VARCHAR REFERENCES users(id),
    branch_id VARCHAR REFERENCES branches(id),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    total_sales REAL NOT NULL,
    target_amount REAL,
    achievement_percent REAL,
    rate_id INTEGER REFERENCES commission_rates(id),
    calculated_commission REAL NOT NULL,
    adjusted_commission REAL,
    final_commission REAL NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    journal_ids JSONB,
    notes TEXT,
    approved_by VARCHAR REFERENCES users(id),
    approved_at TIMESTAMP,
    paid_at TIMESTAMP,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 47. جدول ملخص المبيعات اليومية للفروع
-- =====================================================
CREATE TABLE IF NOT EXISTS branch_daily_sales (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    sales_date TEXT NOT NULL,
    total_sales REAL DEFAULT 0 NOT NULL,
    transactions_count INTEGER DEFAULT 0,
    average_ticket REAL DEFAULT 0,
    cashier_count INTEGER DEFAULT 0,
    target_amount REAL DEFAULT 0,
    achievement_amount REAL DEFAULT 0,
    achievement_percent REAL DEFAULT 0,
    morning_shift_sales REAL DEFAULT 0,
    evening_shift_sales REAL DEFAULT 0,
    night_shift_sales REAL DEFAULT 0,
    journal_ids JSONB,
    computed_at TIMESTAMP DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 48. جدول أداء الكاشير في الشفت
-- =====================================================
CREATE TABLE IF NOT EXISTS cashier_shift_performance (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER REFERENCES cashier_sales_journals(id),
    cashier_id VARCHAR NOT NULL REFERENCES users(id),
    cashier_name TEXT NOT NULL,
    shift_id INTEGER REFERENCES shifts(id),
    shift_type TEXT NOT NULL,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    performance_date TEXT NOT NULL,
    sales_amount REAL DEFAULT 0 NOT NULL,
    transactions_count INTEGER DEFAULT 0,
    average_ticket REAL DEFAULT 0,
    customer_count INTEGER DEFAULT 0,
    target_share REAL DEFAULT 0,
    achievement_percent REAL DEFAULT 0,
    discrepancy_amount REAL DEFAULT 0,
    discrepancy_status TEXT DEFAULT 'balanced',
    branch_rank INTEGER,
    shift_rank INTEGER,
    computed_at TIMESTAMP DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 49. جدول استلام بار العرض
-- =====================================================
CREATE TABLE IF NOT EXISTS display_bar_receipts (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    receipt_date TEXT NOT NULL,
    receipt_time TEXT NOT NULL,
    shift_id INTEGER REFERENCES shifts(id),
    quantity INTEGER NOT NULL,
    received_by VARCHAR REFERENCES users(id),
    production_batch TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 50. جدول ملخص بار العرض اليومي
-- =====================================================
CREATE TABLE IF NOT EXISTS display_bar_daily_summary (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    summary_date TEXT NOT NULL,
    opening_quantity INTEGER DEFAULT 0 NOT NULL,
    received_quantity INTEGER DEFAULT 0 NOT NULL,
    sold_quantity INTEGER DEFAULT 0 NOT NULL,
    wasted_quantity INTEGER DEFAULT 0 NOT NULL,
    closing_quantity INTEGER DEFAULT 0 NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 51. جدول تقارير الهالك
-- =====================================================
CREATE TABLE IF NOT EXISTS waste_reports (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    report_date TEXT NOT NULL,
    shift_id INTEGER REFERENCES shifts(id),
    shift_name TEXT,
    reported_by VARCHAR REFERENCES users(id),
    reporter_name TEXT,
    total_items INTEGER DEFAULT 0 NOT NULL,
    total_value REAL DEFAULT 0,
    status TEXT DEFAULT 'draft' NOT NULL,
    approved_by VARCHAR REFERENCES users(id),
    approved_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 52. جدول عناصر الهالك
-- =====================================================
CREATE TABLE IF NOT EXISTS waste_items (
    id SERIAL PRIMARY KEY,
    waste_report_id INTEGER NOT NULL REFERENCES waste_reports(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price REAL DEFAULT 0,
    total_value REAL DEFAULT 0,
    waste_reason TEXT NOT NULL,
    reason_details TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 53. جدول أوامر الإنتاج المتقدمة
-- =====================================================
CREATE TABLE IF NOT EXISTS advanced_production_orders (
    id SERIAL PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    order_type TEXT DEFAULT 'daily' NOT NULL,
    source_branch_id VARCHAR NOT NULL REFERENCES branches(id),
    target_branch_id VARCHAR NOT NULL REFERENCES branches(id),
    target_department TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' NOT NULL,
    priority TEXT DEFAULT 'normal' NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    target_sales_value REAL,
    estimated_cost REAL DEFAULT 0,
    actual_cost REAL DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    completed_items INTEGER DEFAULT 0,
    completion_percent REAL DEFAULT 0,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    ai_plan_id INTEGER,
    notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    approved_by VARCHAR REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 54. جدول عناصر أمر الإنتاج
-- =====================================================
CREATE TABLE IF NOT EXISTS production_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES advanced_production_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name TEXT NOT NULL,
    product_category TEXT,
    target_quantity INTEGER NOT NULL,
    produced_quantity INTEGER DEFAULT 0,
    wasted_quantity INTEGER DEFAULT 0,
    unit_price REAL DEFAULT 0,
    total_value REAL DEFAULT 0,
    scheduled_date TEXT,
    scheduled_shift TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    assigned_to TEXT,
    priority INTEGER DEFAULT 0,
    sales_velocity REAL,
    notes TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 55. جدول جدولة أوامر الإنتاج
-- =====================================================
CREATE TABLE IF NOT EXISTS production_order_schedules (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES advanced_production_orders(id) ON DELETE CASCADE,
    scheduled_date TEXT NOT NULL,
    day_of_week TEXT,
    shift TEXT,
    target_quantity INTEGER DEFAULT 0,
    completed_quantity INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' NOT NULL,
    assigned_department TEXT,
    assigned_employees TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 56. جدول خطط الذكاء الاصطناعي للإنتاج
-- =====================================================
CREATE TABLE IF NOT EXISTS production_ai_plans (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    plan_name TEXT NOT NULL,
    target_sales_value REAL NOT NULL,
    plan_date TEXT NOT NULL,
    dataset_id INTEGER,
    algorithm_version TEXT DEFAULT 'v1.0',
    confidence_score REAL DEFAULT 0,
    recommended_products JSONB,
    total_estimated_value REAL DEFAULT 0,
    total_estimated_cost REAL DEFAULT 0,
    profit_margin REAL DEFAULT 0,
    status TEXT DEFAULT 'generated' NOT NULL,
    applied_to_order_id INTEGER,
    reviewed_by VARCHAR REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 57. جدول رفع بيانات المبيعات
-- =====================================================
CREATE TABLE IF NOT EXISTS sales_data_uploads (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    file_name TEXT NOT NULL,
    file_type TEXT DEFAULT 'excel',
    file_size INTEGER,
    period_start TEXT,
    period_end TEXT,
    total_records INTEGER DEFAULT 0,
    total_sales_value REAL DEFAULT 0,
    unique_products INTEGER DEFAULT 0,
    parsed_data JSONB,
    product_velocity JSONB,
    status TEXT DEFAULT 'pending' NOT NULL,
    error_message TEXT,
    uploaded_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 58. جدول تحليلات مبيعات المنتجات
-- =====================================================
CREATE TABLE IF NOT EXISTS product_sales_analytics (
    id SERIAL PRIMARY KEY,
    upload_id INTEGER NOT NULL REFERENCES sales_data_uploads(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name TEXT NOT NULL,
    product_category TEXT,
    total_quantity_sold INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    average_daily_sales REAL DEFAULT 0,
    sales_velocity REAL DEFAULT 0,
    profit_margin REAL DEFAULT 0,
    peak_hours TEXT,
    weekday_pattern TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 59. جدول دفعات الإنتاج اليومية
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_production_batches (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    product_id INTEGER REFERENCES products(id),
    product_name TEXT NOT NULL,
    product_category TEXT,
    quantity INTEGER NOT NULL,
    unit TEXT DEFAULT 'قطعة',
    destination TEXT NOT NULL,
    shift_id INTEGER REFERENCES shifts(id),
    production_order_id INTEGER,
    produced_at TIMESTAMP DEFAULT NOW() NOT NULL,
    recorded_by VARCHAR REFERENCES users(id),
    recorder_name TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 60. جدول الأقسام
-- =====================================================
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 61. جدول الأدوار
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    hierarchy_level INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    is_system_default BOOLEAN DEFAULT FALSE NOT NULL,
    inherits_from_role_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 62. جدول الصلاحيات
-- =====================================================
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    module VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 63. جدول صلاحيات الأدوار
-- =====================================================
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    scope JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 64. جدول تعيينات المستخدمين
-- =====================================================
CREATE TABLE IF NOT EXISTS user_assignments (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    branch_id VARCHAR REFERENCES branches(id) ON DELETE SET NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    scope_type VARCHAR(20) NOT NULL DEFAULT 'branch',
    is_primary BOOLEAN DEFAULT TRUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    start_date TIMESTAMP DEFAULT NOW(),
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 65. جدول تجاوزات صلاحيات المستخدم
-- =====================================================
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

-- =====================================================
-- 66. جدول وصول المستخدم للفروع
-- =====================================================
CREATE TABLE IF NOT EXISTS user_branch_access (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id VARCHAR NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    access_level VARCHAR(20) NOT NULL DEFAULT 'full',
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 67. جدول أهداف الكاشير داخل الشفت
-- =====================================================
CREATE TABLE IF NOT EXISTS cashier_shift_targets (
    id SERIAL PRIMARY KEY,
    shift_allocation_id INTEGER REFERENCES target_shift_allocations(id) ON DELETE CASCADE,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    cashier_id VARCHAR NOT NULL REFERENCES users(id),
    target_date TEXT NOT NULL,
    shift_type TEXT NOT NULL,
    cashier_role TEXT DEFAULT 'main' NOT NULL,
    target_amount REAL NOT NULL,
    target_ticket_value REAL,
    target_transactions INTEGER,
    shift_start_time TEXT,
    shift_end_time TEXT,
    shift_duration_hours REAL,
    alert_threshold_percent REAL DEFAULT 80,
    below_track_threshold REAL DEFAULT 70,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 68. جدول أهداف متوسط الفاتورة
-- =====================================================
CREATE TABLE IF NOT EXISTS average_ticket_targets (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR REFERENCES branches(id),
    cashier_id VARCHAR REFERENCES users(id),
    shift_type TEXT,
    target_type TEXT NOT NULL,
    target_value REAL NOT NULL,
    min_acceptable REAL,
    bonus_threshold REAL,
    bonus_per_riyal REAL,
    valid_from TEXT NOT NULL,
    valid_to TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 69. جدول تنبيهات الأداء
-- =====================================================
CREATE TABLE IF NOT EXISTS performance_alerts (
    id SERIAL PRIMARY KEY,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    cashier_id VARCHAR REFERENCES users(id),
    shift_type TEXT,
    alert_date TEXT NOT NULL,
    alert_time TEXT NOT NULL,
    target_amount REAL,
    current_amount REAL,
    achievement_percent REAL,
    message TEXT NOT NULL,
    message_ar TEXT,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    is_acknowledged BOOLEAN DEFAULT FALSE NOT NULL,
    acknowledged_by VARCHAR REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 70. جدول تتبع أداء الشفت
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_performance_tracking (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    tracking_date TEXT NOT NULL,
    shift_type TEXT NOT NULL,
    shift_start_time TEXT NOT NULL,
    shift_end_time TEXT,
    shift_target_amount REAL NOT NULL,
    expected_at_current_time REAL DEFAULT 0,
    current_sales_amount REAL DEFAULT 0 NOT NULL,
    current_transactions INTEGER DEFAULT 0,
    current_average_ticket REAL DEFAULT 0,
    current_cashier_count INTEGER DEFAULT 0,
    achievement_percent REAL DEFAULT 0,
    progress_status TEXT DEFAULT 'on_track',
    estimated_end_amount REAL DEFAULT 0,
    top_cashier_id VARCHAR REFERENCES users(id),
    top_cashier_sales REAL DEFAULT 0,
    lowest_cashier_id VARCHAR REFERENCES users(id),
    lowest_cashier_sales REAL DEFAULT 0,
    last_updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 71. جدول الحملات التسويقية
-- =====================================================
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT,
    description TEXT,
    objective TEXT NOT NULL,
    season TEXT,
    status TEXT DEFAULT 'draft' NOT NULL,
    total_budget REAL DEFAULT 0 NOT NULL,
    spent_budget REAL DEFAULT 0 NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    target_audience TEXT,
    channels TEXT[],
    kpis JSONB,
    owner_id VARCHAR REFERENCES users(id),
    created_by VARCHAR REFERENCES users(id),
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 72. جدول توزيع ميزانية الحملة
-- =====================================================
CREATE TABLE IF NOT EXISTS campaign_budget_allocations (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    allocated_budget REAL NOT NULL,
    spent_amount REAL DEFAULT 0 NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 73. جدول أهداف الحملة
-- =====================================================
CREATE TABLE IF NOT EXISTS campaign_goals (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    goal_type TEXT NOT NULL,
    target_value REAL NOT NULL,
    current_value REAL DEFAULT 0 NOT NULL,
    unit TEXT,
    description TEXT,
    deadline TEXT,
    is_achieved BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 74. جدول المؤثرين
-- =====================================================
CREATE TABLE IF NOT EXISTS marketing_influencers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT,
    email TEXT,
    phone TEXT,
    profile_image_url TEXT,
    specialty TEXT NOT NULL,
    platforms TEXT[],
    content_types TEXT[],
    follower_count INTEGER DEFAULT 0,
    engagement_rate REAL,
    avg_views INTEGER DEFAULT 0,
    price_per_post REAL,
    price_per_story REAL,
    price_per_video REAL,
    city TEXT,
    region TEXT,
    social_handles JSONB,
    best_collaboration_times TEXT,
    notes TEXT,
    rating REAL,
    total_collaborations INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    ai_insights JSONB,
    last_contact_date TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 75. جدول مصروفات الحملات
-- =====================================================
CREATE TABLE IF NOT EXISTS campaign_expenses (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    influencer_id INTEGER REFERENCES marketing_influencers(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'SAR' NOT NULL,
    expense_date TEXT NOT NULL,
    payment_method TEXT,
    reference_number TEXT,
    invoice_number TEXT,
    vendor TEXT,
    attachment_url TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    approved_by VARCHAR REFERENCES users(id),
    approved_at TIMESTAMP,
    notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 76. جدول تقويم التسويق
-- =====================================================
CREATE TABLE IF NOT EXISTS marketing_calendar_events (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    start_time TEXT,
    end_time TEXT,
    is_all_day BOOLEAN DEFAULT FALSE NOT NULL,
    color TEXT,
    assigned_to VARCHAR REFERENCES users(id),
    reminder_minutes INTEGER,
    is_recurring BOOLEAN DEFAULT FALSE NOT NULL,
    recurring_pattern TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 77. جدول ربط المؤثرين بالحملات
-- =====================================================
CREATE TABLE IF NOT EXISTS influencer_campaign_links (
    id SERIAL PRIMARY KEY,
    influencer_id INTEGER NOT NULL REFERENCES marketing_influencers(id) ON DELETE CASCADE,
    campaign_id INTEGER NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' NOT NULL,
    contract_amount REAL,
    deliverables JSONB,
    deliverables_done JSONB,
    start_date TEXT,
    end_date TEXT,
    performance_score REAL,
    sales_impact REAL,
    engagement_generated INTEGER,
    impressions_generated INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 78. جدول سجل التواصل مع المؤثرين
-- =====================================================
CREATE TABLE IF NOT EXISTS influencer_contacts (
    id SERIAL PRIMARY KEY,
    influencer_id INTEGER NOT NULL REFERENCES marketing_influencers(id) ON DELETE CASCADE,
    contact_type TEXT NOT NULL,
    contact_date TEXT NOT NULL,
    contact_time TEXT,
    subject TEXT,
    notes TEXT,
    outcome TEXT,
    next_follow_up TEXT,
    contacted_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 79. جدول مدفوعات المؤثرين
-- =====================================================
CREATE TABLE IF NOT EXISTS influencer_payments (
    id SERIAL PRIMARY KEY,
    influencer_id INTEGER NOT NULL REFERENCES marketing_influencers(id) ON DELETE CASCADE,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    payment_type TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'SAR' NOT NULL,
    payment_date TEXT NOT NULL,
    payment_method TEXT,
    reference_number TEXT,
    description TEXT,
    status TEXT DEFAULT 'completed' NOT NULL,
    invoice_number TEXT,
    attachment_url TEXT,
    notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    approved_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 80. جدول مهام التسويق
-- =====================================================
CREATE TABLE IF NOT EXISTS marketing_tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    assigned_to VARCHAR REFERENCES users(id),
    assigned_by VARCHAR REFERENCES users(id),
    priority TEXT DEFAULT 'medium' NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    due_date TEXT,
    completed_at TIMESTAMP,
    estimated_hours REAL,
    actual_hours REAL,
    category TEXT,
    attachments JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 81. جدول نشاط مهام التسويق
-- =====================================================
CREATE TABLE IF NOT EXISTS marketing_task_activities (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES marketing_tasks(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    description TEXT,
    old_value TEXT,
    new_value TEXT,
    user_id VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 82. جدول تقارير أداء التسويق
-- =====================================================
CREATE TABLE IF NOT EXISTS marketing_performance_reports (
    id SERIAL PRIMARY KEY,
    report_type TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    branch_id VARCHAR REFERENCES branches(id),
    total_spend REAL DEFAULT 0,
    total_reach INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    total_engagement INTEGER DEFAULT 0,
    engagement_rate REAL DEFAULT 0,
    estimated_sales_impact REAL DEFAULT 0,
    actual_sales_impact REAL DEFAULT 0,
    roi REAL DEFAULT 0,
    cost_per_engagement REAL DEFAULT 0,
    cost_per_impression REAL DEFAULT 0,
    previous_period_sales REAL,
    sales_growth REAL,
    top_performing_content JSONB,
    top_influencers JSONB,
    recommendations JSONB,
    generated_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 83. جدول الأصول التسويقية
-- =====================================================
CREATE TABLE IF NOT EXISTS marketing_assets (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    category TEXT,
    tags TEXT[],
    file_size INTEGER,
    dimensions TEXT,
    duration INTEGER,
    usage_count INTEGER DEFAULT 0,
    uploaded_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 84. جدول أعضاء فريق التسويق
-- =====================================================
CREATE TABLE IF NOT EXISTS marketing_team_members (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    role TEXT NOT NULL,
    specialization TEXT,
    is_team_lead BOOLEAN DEFAULT FALSE NOT NULL,
    assigned_branches TEXT[],
    weekly_hours_capacity REAL DEFAULT 40,
    current_workload REAL DEFAULT 0,
    join_date TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 85. جدول تنبيهات التسويق
-- =====================================================
CREATE TABLE IF NOT EXISTS marketing_alerts (
    id SERIAL PRIMARY KEY,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES marketing_tasks(id) ON DELETE CASCADE,
    target_user_id VARCHAR REFERENCES users(id),
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    is_acknowledged BOOLEAN DEFAULT FALSE NOT NULL,
    acknowledged_by VARCHAR REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    scheduled_for TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 86. جدول قوالب جداول الورديات
-- =====================================================
CREATE TABLE IF NOT EXISTS schedule_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    branch_id VARCHAR REFERENCES branches(id),
    is_default BOOLEAN DEFAULT FALSE,
    weekly_pattern JSONB,
    created_by VARCHAR REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 87. جدول فترات الجدول
-- =====================================================
CREATE TABLE IF NOT EXISTS schedule_periods (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    period_type TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT DEFAULT 'draft' NOT NULL,
    template_id INTEGER REFERENCES schedule_templates(id),
    required_staff_per_day JSONB,
    notes TEXT,
    published_by VARCHAR REFERENCES users(id),
    published_at TIMESTAMP,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schedule_periods_branch ON schedule_periods(branch_id);
CREATE INDEX IF NOT EXISTS idx_schedule_periods_dates ON schedule_periods(start_date, end_date);

-- =====================================================
-- 88. جدول جداول الموظفين
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_schedules (
    id SERIAL PRIMARY KEY,
    period_id INTEGER REFERENCES schedule_periods(id) ON DELETE CASCADE,
    employee_id VARCHAR NOT NULL REFERENCES users(id),
    employee_name TEXT NOT NULL,
    branch_id VARCHAR REFERENCES branches(id),
    branch_employee_id INTEGER,
    schedule_date TEXT NOT NULL,
    day_of_week TEXT NOT NULL,
    shift_type TEXT,
    start_time TEXT,
    end_time TEXT,
    is_off BOOLEAN DEFAULT FALSE NOT NULL,
    break_duration INTEGER DEFAULT 60,
    status TEXT DEFAULT 'scheduled' NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_employee_schedules_period ON employee_schedules(period_id);
CREATE INDEX IF NOT EXISTS idx_employee_schedules_employee ON employee_schedules(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_schedules_date ON employee_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_employee_schedules_branch ON employee_schedules(branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_schedules_branch_employee ON employee_schedules(branch_employee_id);

-- =====================================================
-- 89. جدول سجلات الحضور والانصراف
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR NOT NULL REFERENCES users(id),
    employee_name TEXT NOT NULL,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    branch_employee_id INTEGER,
    schedule_id INTEGER REFERENCES employee_schedules(id),
    attendance_date TEXT NOT NULL,
    scheduled_start_time TEXT,
    scheduled_end_time TEXT,
    actual_check_in TEXT,
    actual_check_out TEXT,
    check_in_signature TEXT,
    check_out_signature TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    late_minutes INTEGER DEFAULT 0,
    early_leave_minutes INTEGER DEFAULT 0,
    overtime_minutes INTEGER DEFAULT 0,
    working_hours REAL DEFAULT 0,
    device_info TEXT,
    location_info TEXT,
    notes TEXT,
    approved_by VARCHAR REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_branch ON attendance_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_branch_employee ON attendance_records(branch_employee_id);

-- =====================================================
-- 90. جدول إدخالات الوقت
-- =====================================================
CREATE TABLE IF NOT EXISTS time_entries (
    id SERIAL PRIMARY KEY,
    attendance_id INTEGER REFERENCES attendance_records(id) ON DELETE CASCADE,
    employee_id VARCHAR NOT NULL REFERENCES users(id),
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    entry_type TEXT NOT NULL,
    entry_time TIMESTAMP DEFAULT NOW() NOT NULL,
    signature TEXT,
    signature_type TEXT,
    device_id TEXT,
    ip_address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_time_entries_attendance ON time_entries(attendance_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_branch ON time_entries(branch_id);

-- =====================================================
-- 91. جدول ملخص الحضور الشهري
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance_summary (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR NOT NULL REFERENCES users(id),
    employee_name TEXT NOT NULL,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    period_month TEXT NOT NULL,
    total_scheduled_days INTEGER DEFAULT 0,
    total_present_days INTEGER DEFAULT 0,
    total_absent_days INTEGER DEFAULT 0,
    total_late_days INTEGER DEFAULT 0,
    total_early_leave_days INTEGER DEFAULT 0,
    total_leave_days INTEGER DEFAULT 0,
    total_working_hours REAL DEFAULT 0,
    total_overtime_hours REAL DEFAULT 0,
    total_late_minutes INTEGER DEFAULT 0,
    total_early_leave_minutes INTEGER DEFAULT 0,
    attendance_rate REAL DEFAULT 0,
    punctuality_rate REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attendance_summary_employee ON attendance_summary(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_summary_branch ON attendance_summary(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_summary_month ON attendance_summary(period_month);

-- =====================================================
-- 92. جدول تقارير الدوام
-- =====================================================
CREATE TABLE IF NOT EXISTS timesheet_reports (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR NOT NULL REFERENCES users(id),
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    branch_employee_id INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    generated_by VARCHAR REFERENCES users(id),
    status TEXT DEFAULT 'pending' NOT NULL,
    total_scheduled_days INTEGER DEFAULT 0,
    total_present_days INTEGER DEFAULT 0,
    total_absent_days INTEGER DEFAULT 0,
    total_late_days INTEGER DEFAULT 0,
    total_scheduled_hours REAL DEFAULT 0,
    total_actual_hours REAL DEFAULT 0,
    total_overtime_minutes INTEGER DEFAULT 0,
    total_late_minutes INTEGER DEFAULT 0,
    employee_signature TEXT,
    employee_signed_at TIMESTAMP,
    employee_acknowledgment TEXT,
    manager_signature TEXT,
    manager_id VARCHAR REFERENCES users(id),
    manager_signed_at TIMESTAMP,
    manager_acknowledgment TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_timesheet_reports_employee ON timesheet_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_reports_branch ON timesheet_reports(branch_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_reports_status ON timesheet_reports(status);
CREATE INDEX IF NOT EXISTS idx_timesheet_reports_dates ON timesheet_reports(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_timesheet_reports_branch_employee ON timesheet_reports(branch_employee_id);

-- =====================================================
-- 93. جدول سجلات تقرير الدوام اليومية
-- =====================================================
CREATE TABLE IF NOT EXISTS timesheet_report_entries (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES timesheet_reports(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    day_of_week TEXT NOT NULL,
    scheduled_start_time TEXT,
    scheduled_end_time TEXT,
    actual_start_time TEXT,
    actual_end_time TEXT,
    is_off BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending',
    scheduled_hours REAL DEFAULT 0,
    actual_hours REAL DEFAULT 0,
    overtime_minutes INTEGER DEFAULT 0,
    late_minutes INTEGER DEFAULT 0,
    notes TEXT,
    check_in_signature TEXT,
    check_out_signature TEXT
);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_report ON timesheet_report_entries(report_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_date ON timesheet_report_entries(date);

-- =====================================================
-- 94. جدول موظفي الفروع
-- =====================================================
CREATE TABLE IF NOT EXISTS branch_employees (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    linked_user_id VARCHAR REFERENCES users(id),
    default_schedule_template_id INTEGER REFERENCES schedule_templates(id),
    employee_name TEXT NOT NULL,
    employee_name_en TEXT,
    job_title TEXT NOT NULL,
    department TEXT,
    nationality TEXT NOT NULL,
    salary REAL NOT NULL,
    housing_allowance REAL DEFAULT 0,
    transport_allowance REAL DEFAULT 0,
    food_allowance REAL DEFAULT 0,
    other_allowances REAL DEFAULT 0,
    total_salary REAL,
    hire_date TEXT,
    health_certificate TEXT DEFAULT 'none',
    health_certificate_expiry TEXT,
    iqama_number TEXT,
    iqama_expiry TEXT,
    passport_number TEXT,
    passport_expiry TEXT,
    phone_number TEXT,
    emergency_contact TEXT,
    bank_name TEXT,
    bank_account_number TEXT,
    status TEXT DEFAULT 'active' NOT NULL,
    contract_type TEXT DEFAULT 'full_time',
    work_permit_number TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_branch_employees_branch ON branch_employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_employees_nationality ON branch_employees(nationality);
CREATE INDEX IF NOT EXISTS idx_branch_employees_status ON branch_employees(status);
CREATE INDEX IF NOT EXISTS idx_branch_employees_job ON branch_employees(job_title);
CREATE INDEX IF NOT EXISTS idx_branch_employees_linked_user ON branch_employees(linked_user_id);

-- =====================================================
-- نهاية المخطط
-- =====================================================
