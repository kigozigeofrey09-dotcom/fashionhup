-- =====================================================================
-- FASHIONHUB MASTER SUPABASE SQL MIGRATION SCRIPT
-- Run this complete script in your Supabase SQL Editor to ensure all tables,
-- indexes, policies, and storage buckets are fully provisioned.
-- =====================================================================

-- 1. SHOPS TABLE
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    story TEXT NOT NULL,
    tagline TEXT,
    categories TEXT[] DEFAULT '{}',
    sell_type TEXT DEFAULT 'products',
    country_code TEXT NOT NULL,
    country_name TEXT,
    city TEXT NOT NULL,
    accent TEXT DEFAULT '#496a4d',
    whatsapp_number TEXT,
    logo_url TEXT,
    cover_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LISTINGS TABLE
CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    shop_name TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT DEFAULT 'product',
    description TEXT NOT NULL,
    price NUMERIC NOT NULL,
    currency TEXT DEFAULT 'UGX',
    country_code TEXT NOT NULL,
    country_name TEXT,
    city TEXT NOT NULL,
    image TEXT NOT NULL,
    images TEXT[] DEFAULT '{}',
    sizes TEXT,
    colour TEXT,
    service_details TEXT,
    enquiry_label TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    promotion TEXT,
    is_seed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENQUIRIES TABLE
CREATE TABLE IF NOT EXISTS enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    buyer_id UUID,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUBSCRIPTIONS & MANUAL MOMO RECORDS TABLE
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    plan_name TEXT,
    payer_type TEXT DEFAULT 'seller',
    country_code TEXT DEFAULT 'UG',
    transaction_reference TEXT NOT NULL,
    receipt_url TEXT,
    status TEXT DEFAULT 'pending_verification', -- pending_verification, approved, declined, expired
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

-- 5. SUBSCRIPTION AUDIT LOGS (MTN MoMo 0773927881 tracking)
CREATE TABLE IF NOT EXISTS subscription_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    transaction_ref TEXT NOT NULL,
    amount_ugx NUMERIC DEFAULT 10000,
    status TEXT DEFAULT 'pending',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    admin_notes TEXT
);

-- 6. SAFETY REPORTS TABLE
CREATE TABLE IF NOT EXISTS safety_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
    account_id UUID,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending', -- pending, reviewing, resolved, dismissed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. COUNTRIES & PAYMENT INSTRUCTIONS TABLE
CREATE TABLE IF NOT EXISTS countries (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    cities TEXT[] DEFAULT '{}',
    payment_instructions TEXT
);

-- 9. MARKETPLACE ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS marketplace_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    category TEXT,
    search_query TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- INDEXES FOR HIGH PERFORMANCE
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_listings_shop ON listings(shop_id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_sub_audit_ref ON subscription_audit_logs(transaction_ref);

-- =====================================================================
-- REALTIME PUBLICATIONS
-- =====================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE listings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE shops;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE enquiries;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE subscriptions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- STORAGE BUCKET FOR MEDIA UPLOADS
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('fashionhub-media', 'fashionhub-media', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) & PERMISSIVE POLICIES
-- =====================================================================
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_analytics ENABLE ROW LEVEL SECURITY;

-- Permissive policies for development & production access
CREATE POLICY "Public shops read" ON shops FOR SELECT USING (true);
CREATE POLICY "Public shops insert" ON shops FOR INSERT WITH CHECK (true);
CREATE POLICY "Public shops update" ON shops FOR UPDATE USING (true);

CREATE POLICY "Public listings read" ON listings FOR SELECT USING (true);
CREATE POLICY "Public listings insert" ON listings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public listings update" ON listings FOR UPDATE USING (true);
CREATE POLICY "Public listings delete" ON listings FOR DELETE USING (true);

CREATE POLICY "Public enquiries read" ON enquiries FOR SELECT USING (true);
CREATE POLICY "Public enquiries insert" ON enquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Public enquiries update" ON enquiries FOR UPDATE USING (true);

CREATE POLICY "Public subscriptions read" ON subscriptions FOR SELECT USING (true);
CREATE POLICY "Public subscriptions insert" ON subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public subscriptions update" ON subscriptions FOR UPDATE USING (true);

CREATE POLICY "Public audit read" ON subscription_audit_logs FOR SELECT USING (true);
CREATE POLICY "Public audit insert" ON subscription_audit_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Public reports read" ON safety_reports FOR SELECT USING (true);
CREATE POLICY "Public reports insert" ON safety_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Public reports update" ON safety_reports FOR UPDATE USING (true);

CREATE POLICY "Public notifications read" ON notifications FOR SELECT USING (true);
CREATE POLICY "Public notifications insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Public notifications update" ON notifications FOR UPDATE USING (true);

CREATE POLICY "Public countries read" ON countries FOR SELECT USING (true);
CREATE POLICY "Public countries insert" ON countries FOR INSERT WITH CHECK (true);
CREATE POLICY "Public countries update" ON countries FOR UPDATE USING (true);

CREATE POLICY "Public analytics insert" ON marketplace_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "Public analytics read" ON marketplace_analytics FOR SELECT USING (true);
