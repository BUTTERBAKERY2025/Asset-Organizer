-- المسؤولية الاجتماعية - Social Responsibility
-- جداول الجهات المستفيدة والمبادرات الاجتماعية والخصومات المجتمعية

-- الجهات المستفيدة
CREATE TABLE IF NOT EXISTS beneficiary_organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  organization_type TEXT NOT NULL, -- government, charity, ngo, club, educational, healthcare, other
  category TEXT, -- social, environmental, health, education, sports, cultural
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  registration_number TEXT,
  tax_number TEXT,
  website TEXT,
  logo_url TEXT,
  description TEXT,
  partnership_type TEXT, -- discount, donation, sponsorship, collaboration
  discount_percentage NUMERIC(5,2),
  status TEXT DEFAULT 'active', -- active, inactive, suspended
  valid_from DATE,
  valid_to DATE,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beneficiary_org_type ON beneficiary_organizations(organization_type);
CREATE INDEX IF NOT EXISTS idx_beneficiary_org_status ON beneficiary_organizations(status);
CREATE INDEX IF NOT EXISTS idx_beneficiary_org_partnership ON beneficiary_organizations(partnership_type);

-- المبادرات الاجتماعية
CREATE TABLE IF NOT EXISTS social_initiatives (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  title_en TEXT,
  initiative_type TEXT NOT NULL, -- campaign, event, donation, sponsorship, awareness, volunteering
  category TEXT, -- social, environmental, health, education, sports, cultural
  description TEXT,
  objectives TEXT,
  target_audience TEXT,
  start_date DATE,
  end_date DATE,
  budget NUMERIC(12,2),
  actual_cost NUMERIC(12,2),
  beneficiary_organization_id INTEGER REFERENCES beneficiary_organizations(id),
  partners_names TEXT,
  channels TEXT[],
  status TEXT DEFAULT 'planned', -- planned, active, completed, cancelled
  impact_metrics TEXT,
  beneficiaries_count INTEGER,
  media_links TEXT[],
  attachments TEXT[],
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_init_type ON social_initiatives(initiative_type);
CREATE INDEX IF NOT EXISTS idx_social_init_status ON social_initiatives(status);
CREATE INDEX IF NOT EXISTS idx_social_init_dates ON social_initiatives(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_social_init_beneficiary ON social_initiatives(beneficiary_organization_id);

-- رموز الخصم المجتمعية
CREATE TABLE IF NOT EXISTS community_discounts (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL, -- percentage, fixed_amount
  discount_value NUMERIC(10,2) NOT NULL,
  minimum_order NUMERIC(10,2),
  maximum_discount NUMERIC(10,2),
  beneficiary_organization_id INTEGER REFERENCES beneficiary_organizations(id),
  initiative_id INTEGER REFERENCES social_initiatives(id),
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  usage_limit_per_user INTEGER,
  applicable_branches TEXT[],
  applicable_products TEXT[],
  status TEXT DEFAULT 'active', -- active, inactive, expired
  terms TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_discount_code ON community_discounts(code);
CREATE INDEX IF NOT EXISTS idx_community_discount_status ON community_discounts(status);
CREATE INDEX IF NOT EXISTS idx_community_discount_validity ON community_discounts(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_community_discount_org ON community_discounts(beneficiary_organization_id);

-- سجل استخدام الخصومات
CREATE TABLE IF NOT EXISTS discount_usage_logs (
  id SERIAL PRIMARY KEY,
  discount_id INTEGER NOT NULL REFERENCES community_discounts(id) ON DELETE CASCADE,
  branch_id VARCHAR REFERENCES branches(id),
  order_id TEXT,
  order_amount NUMERIC(12,2),
  discount_amount NUMERIC(10,2),
  customer_name TEXT,
  customer_phone TEXT,
  used_by VARCHAR REFERENCES users(id),
  used_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_discount_usage_discount ON discount_usage_logs(discount_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_branch ON discount_usage_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_date ON discount_usage_logs(used_at);
