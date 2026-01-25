-- جدول وثائق المساهمين - Shareholder Documents
-- هذا الجدول يخزن الوثائق المرفقة بكل مساهم

CREATE TABLE IF NOT EXISTS shareholder_documents (
  id SERIAL PRIMARY KEY,
  shareholder_id INTEGER NOT NULL REFERENCES shareholders(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- national_id, share_certificate, commercial_register, contract, bank_statement, other
  document_name TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  expiry_date DATE,
  notes TEXT,
  uploaded_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- إضافة الفهارس
CREATE INDEX IF NOT EXISTS idx_shareholder_docs_shareholder ON shareholder_documents(shareholder_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_docs_type ON shareholder_documents(document_type);
