-- Influencer Payments/Ledger Table - كشف حساب المؤثرين
-- Run this SQL in Supabase SQL Editor before deploying the code

CREATE TABLE IF NOT EXISTS influencer_payments (
    id SERIAL PRIMARY KEY,
    influencer_id INTEGER NOT NULL REFERENCES marketing_influencers(id) ON DELETE CASCADE,
    campaign_id INTEGER REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
    payment_type TEXT NOT NULL, -- advance, milestone, final, bonus, refund
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'SAR' NOT NULL,
    payment_date TEXT NOT NULL, -- YYYY-MM-DD
    payment_method TEXT, -- bank_transfer, cash, check, online
    reference_number TEXT, -- رقم الحوالة أو الشيك
    description TEXT,
    status TEXT DEFAULT 'completed' NOT NULL, -- pending, completed, cancelled, refunded
    invoice_number TEXT,
    attachment_url TEXT, -- رابط الفاتورة أو الإيصال
    notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    approved_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_influencer_payments_influencer_id ON influencer_payments(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_payments_campaign_id ON influencer_payments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_influencer_payments_payment_date ON influencer_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_influencer_payments_status ON influencer_payments(status);
