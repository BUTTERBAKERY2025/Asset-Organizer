-- =====================================================
-- تحديث جدول المؤثرين - إضافة الحقول الجديدة
-- تاريخ: 2026-01-10
-- =====================================================

-- إضافة الحقول الجديدة لجدول marketing_influencers
-- ملاحظة: قم بتنفيذ هذه الأوامر إذا كان الجدول موجوداً بالفعل

-- 1. رابط الحساب على وسائل التواصل
ALTER TABLE marketing_influencers 
ADD COLUMN IF NOT EXISTS account_url TEXT;

-- 2. رابط التغطية/التعاون
ALTER TABLE marketing_influencers 
ADD COLUMN IF NOT EXISTS coverage_url TEXT;

-- 3. عدد المتابعين كنص (مثل "133k")
ALTER TABLE marketing_influencers 
ADD COLUMN IF NOT EXISTS follower_count_text TEXT;

-- 4. تقييم المشاهدات (1-100)
ALTER TABLE marketing_influencers 
ADD COLUMN IF NOT EXISTS view_rating INTEGER;

-- 5. رقم الحساب البنكي
ALTER TABLE marketing_influencers 
ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

-- 6. اسم صاحب الحساب البنكي
ALTER TABLE marketing_influencers 
ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;

-- 7. اسم البنك
ALTER TABLE marketing_influencers 
ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- =====================================================
-- إذا لم يكن الجدول موجوداً، استخدم الأمر التالي لإنشائه بالكامل:
-- =====================================================

/*
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
    follower_count_text TEXT,
    engagement_rate REAL,
    avg_views INTEGER DEFAULT 0,
    view_rating INTEGER,
    price_per_post REAL,
    price_per_story REAL,
    price_per_video REAL,
    city TEXT,
    region TEXT,
    social_handles JSONB,
    account_url TEXT,
    coverage_url TEXT,
    bank_account_number TEXT,
    bank_account_holder TEXT,
    bank_name TEXT,
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

-- إنشاء الفهارس
CREATE INDEX IF NOT EXISTS idx_marketing_influencers_specialty ON marketing_influencers(specialty);
CREATE INDEX IF NOT EXISTS idx_marketing_influencers_region ON marketing_influencers(region);
CREATE INDEX IF NOT EXISTS idx_marketing_influencers_is_active ON marketing_influencers(is_active);
*/

-- =====================================================
-- الجداول المرتبطة (إذا لم تكن موجودة)
-- =====================================================

-- جدول ربط المؤثرين بالحملات
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

-- جدول سجل التواصل مع المؤثرين
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

-- جدول مدفوعات المؤثرين
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
