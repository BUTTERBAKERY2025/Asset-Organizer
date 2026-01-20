-- Migration: Document Management Tables
-- Date: 2026-01-20
-- Description: جداول نظام إدارة الوثائق والأرشفة

-- Document Categories - تصنيفات الوثائق
CREATE TABLE IF NOT EXISTS document_categories (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id),
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    color TEXT DEFAULT '#6B7280',
    icon TEXT DEFAULT 'folder',
    parent_id INTEGER REFERENCES document_categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_categories_branch ON document_categories(branch_id);
CREATE INDEX IF NOT EXISTS idx_doc_categories_parent ON document_categories(parent_id);

-- Document Folders - مجلدات الوثائق
CREATE TABLE IF NOT EXISTS document_folders (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id),
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    parent_id INTEGER REFERENCES document_folders(id),
    path TEXT NOT NULL DEFAULT '/',
    category_id INTEGER REFERENCES document_categories(id),
    access_level TEXT DEFAULT 'internal',
    owner_id VARCHAR(50) REFERENCES users(id),
    owner_name TEXT,
    color TEXT,
    icon TEXT,
    is_locked BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_folders_branch ON document_folders(branch_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_parent ON document_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_category ON document_folders(category_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_owner ON document_folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_path ON document_folders(path);

-- Documents - الوثائق
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES branches(id),
    folder_id INTEGER REFERENCES document_folders(id),
    category_id INTEGER REFERENCES document_categories(id),
    title TEXT NOT NULL,
    title_en TEXT,
    description TEXT,
    description_en TEXT,
    document_number TEXT,
    document_date TIMESTAMP,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT,
    checksum TEXT,
    current_version INTEGER DEFAULT 1,
    access_level TEXT DEFAULT 'internal',
    status TEXT NOT NULL DEFAULT 'active',
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    expiry_date TIMESTAMP,
    retention_period INTEGER,
    is_template BOOLEAN DEFAULT FALSE,
    template_for TEXT,
    related_type TEXT,
    related_id INTEGER,
    owner_id VARCHAR(50) REFERENCES users(id),
    owner_name TEXT,
    last_accessed_at TIMESTAMP,
    last_accessed_by VARCHAR(50) REFERENCES users(id),
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    is_locked BOOLEAN DEFAULT FALSE,
    locked_by VARCHAR(50) REFERENCES users(id),
    locked_at TIMESTAMP,
    archived_at TIMESTAMP,
    archived_by VARCHAR(50) REFERENCES users(id),
    created_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_branch ON documents(branch_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_access ON documents(access_level);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_related ON documents(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(document_date);

-- Document Versions - إصدارات الوثائق
CREATE TABLE IF NOT EXISTS document_versions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT,
    checksum TEXT,
    change_notes TEXT,
    changed_by VARCHAR(50) REFERENCES users(id),
    changed_by_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_number ON document_versions(document_id, version_number);

-- Document Shares - مشاركة الوثائق
CREATE TABLE IF NOT EXISTS document_shares (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    folder_id INTEGER REFERENCES document_folders(id) ON DELETE CASCADE,
    shared_with_user_id VARCHAR(50) REFERENCES users(id),
    shared_with_user_name TEXT,
    shared_with_branch_id VARCHAR(50) REFERENCES branches(id),
    share_type TEXT DEFAULT 'user',
    permission TEXT DEFAULT 'view',
    expires_at TIMESTAMP,
    share_link TEXT,
    share_password TEXT,
    access_count INTEGER DEFAULT 0,
    max_access_count INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    shared_by VARCHAR(50) REFERENCES users(id),
    shared_by_name TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_shares_document ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_folder ON document_shares(folder_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_user ON document_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_branch ON document_shares(shared_with_branch_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_link ON document_shares(share_link);

-- Document Access Logs - سجل الوصول للوثائق
CREATE TABLE IF NOT EXISTS document_access_logs (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id VARCHAR(50) REFERENCES users(id),
    user_name TEXT,
    action TEXT NOT NULL,
    action_details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    version_number INTEGER,
    accessed_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_access_document ON document_access_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_user ON document_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_action ON document_access_logs(action);
CREATE INDEX IF NOT EXISTS idx_doc_access_date ON document_access_logs(accessed_at);

-- Insert default document categories
INSERT INTO document_categories (name, name_en, description, color, icon, sort_order) VALUES
    ('العقود والاتفاقيات', 'Contracts & Agreements', 'عقود العمل والاتفاقيات التجارية', '#3B82F6', 'file-signature', 1),
    ('السياسات والإجراءات', 'Policies & Procedures', 'سياسات الشركة والإجراءات التشغيلية', '#10B981', 'shield', 2),
    ('التقارير', 'Reports', 'التقارير الدورية والتحليلية', '#F59E0B', 'bar-chart', 3),
    ('المراسلات', 'Correspondence', 'المراسلات الرسمية والخارجية', '#8B5CF6', 'mail', 4),
    ('المستندات المالية', 'Financial Documents', 'الفواتير والمستندات المالية', '#EF4444', 'receipt', 5),
    ('الموارد البشرية', 'HR Documents', 'ملفات الموظفين والموارد البشرية', '#06B6D4', 'users', 6),
    ('أخرى', 'Others', 'وثائق متنوعة', '#6B7280', 'folder', 99)
ON CONFLICT DO NOTHING;
