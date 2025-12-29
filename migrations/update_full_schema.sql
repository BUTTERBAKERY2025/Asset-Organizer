-- =====================================================
-- تحديث قاعدة البيانات الشامل - باتر بيكري
-- تاريخ: ديسمبر 2025
-- =====================================================
-- تأكد من تنفيذ هذا الملف على قاعدة البيانات Supabase قبل نشر الكود

-- =====================================================
-- 1. تحديثات على جدول المستخدمين
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id VARCHAR(255) REFERENCES branches(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active TEXT DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- =====================================================
-- 2. جداول صلاحيات الوظائف
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
-- 3. جداول تحويلات الأصول
-- =====================================================
CREATE TABLE IF NOT EXISTS asset_transfers (
    id SERIAL PRIMARY KEY,
    transfer_number TEXT UNIQUE NOT NULL,
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

CREATE TABLE IF NOT EXISTS asset_transfer_events (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL REFERENCES asset_transfers(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id VARCHAR REFERENCES users(id),
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 4. جداول التكاملات والإشعارات
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

CREATE TABLE IF NOT EXISTS notification_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    channel TEXT NOT NULL,
    template TEXT NOT NULL,
    is_active TEXT DEFAULT 'true',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

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
-- 5. جداول نظام التشغيل - المنتجات
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT DEFAULT 'قطعة',
    base_price DOUBLE PRECISION,
    is_active TEXT DEFAULT 'true',
    description TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 6. جداول نظام التشغيل - الورديات
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
-- 7. جداول نظام التشغيل - أوامر الإنتاج
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
-- 8. جداول نظام التشغيل - مراقبة الجودة
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
-- 9. جداول نظام التشغيل - ملخص العمليات اليومية
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
-- 10. جداول يومية مبيعات الكاشير
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

CREATE TABLE IF NOT EXISTS cashier_payment_breakdowns (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER NOT NULL REFERENCES cashier_sales_journals(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL,
    amount REAL DEFAULT 0 NOT NULL,
    transaction_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

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
-- 11. جداول سجل التدقيق والنسخ الاحتياطي
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

CREATE TABLE IF NOT EXISTS backups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    file_size INTEGER,
    file_path TEXT,
    tables TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMP
);

-- =====================================================
-- 12. إنشاء الفهارس للأداء
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_cashier_journals_branch ON cashier_sales_journals(branch_id);
CREATE INDEX IF NOT EXISTS idx_cashier_journals_date ON cashier_sales_journals(journal_date);
CREATE INDEX IF NOT EXISTS idx_cashier_journals_cashier ON cashier_sales_journals(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cashier_journals_status ON cashier_sales_journals(status);
CREATE INDEX IF NOT EXISTS idx_shifts_branch ON shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_production_orders_branch ON production_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_date ON production_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_quality_checks_branch ON quality_checks(branch_id);
CREATE INDEX IF NOT EXISTS idx_quality_checks_date ON quality_checks(check_date);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_status ON asset_transfers(status);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_job_title ON users(job_title);

-- =====================================================
-- انتهى الملف
-- =====================================================
