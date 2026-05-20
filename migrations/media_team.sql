-- فريق التصوير والميديا — جداول بنك الصور والهوية البصرية
-- شغّل هذا الملف في Supabase SQL Editor قبل نشر هذا التحديث على Render

CREATE TABLE IF NOT EXISTS media_assets (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  thumbnail_path TEXT,
  tags TEXT[] DEFAULT '{}'::TEXT[],
  branch_id INTEGER,
  campaign_id INTEGER,
  platform TEXT,
  publish_date TEXT,
  designer TEXT,
  uploaded_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_assets_category ON media_assets(category);
CREATE INDEX IF NOT EXISTS idx_media_assets_branch ON media_assets(branch_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_campaign ON media_assets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_created ON media_assets(created_at DESC);

CREATE TABLE IF NOT EXISTS brand_colors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  hex TEXT NOT NULL,
  description TEXT,
  usage TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_fonts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  language TEXT NOT NULL,
  weights TEXT,
  download_url TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- بذور أولية (اختياري — يمكنك تعديلها لاحقاً)
INSERT INTO brand_colors (name, hex, description, usage, sort_order) VALUES
  ('ذهبي باتر الأساسي', '#D4A574', 'اللون الذهبي الرئيسي للعلامة', 'Primary brand color', 1),
  ('برتقالي دافئ', '#E8833A', 'لون البريق والدعوة لاتخاذ إجراء', 'CTA / Highlights', 2),
  ('بني عميق', '#5C3A21', 'لون النصوص الأساسي على الخلفيات الفاتحة', 'Headings', 3),
  ('كريمي', '#FFF8EE', 'لون الخلفية الناعم', 'Backgrounds', 4),
  ('أبيض', '#FFFFFF', 'الأبيض النقي', 'Backgrounds / Text', 5),
  ('أسود فاحم', '#1A1A1A', 'الأسود للطباعة عالية التباين', 'Print / Mono', 6)
ON CONFLICT DO NOTHING;

INSERT INTO brand_fonts (name, family, language, weights, download_url, notes, sort_order) VALUES
  ('Cairo', 'Cairo, sans-serif', 'ar', '300,400,600,700,800', 'https://fonts.google.com/specimen/Cairo', 'الخط العربي الأساسي', 1),
  ('Plus Jakarta Sans', 'Plus Jakarta Sans, sans-serif', 'en', '300,400,500,600,700,800', 'https://fonts.google.com/specimen/Plus+Jakarta+Sans', 'الخط الإنجليزي الأساسي', 2)
ON CONFLICT DO NOTHING;

-- حملات التصميم (مجلدات تجمع أصول كل حملة)
CREATE TABLE IF NOT EXISTS media_campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_color TEXT DEFAULT '#D4A574',
  status TEXT NOT NULL DEFAULT 'active',
  start_date TEXT,
  end_date TEXT,
  branch_id INTEGER,
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_campaigns_status ON media_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_media_campaigns_branch ON media_campaigns(branch_id);
