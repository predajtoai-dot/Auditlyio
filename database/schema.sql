-- SQL Schéma pre Auditlyio (Aktualizované pre Master Dataset V43)
-- Databáza: PostgreSQL (Supabase)

-- Povolenie rozšírenia pre UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabuľka pre kategórie (Enum typ)
-- Pridané: Tablet, Watch, Audio pre budúcu kompatibilitu
DROP TYPE IF EXISTS product_category CASCADE;
CREATE TYPE product_category AS ENUM ('Mobile', 'Tablet', 'Console', 'Laptop', 'Watch', 'Audio', 'Other');

-- Tabuľka produktov (Hlavná databáza expertných auditov)
DROP TABLE IF EXISTS products CASCADE;
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    model_name VARCHAR(100),
    category product_category NOT NULL,
    display_tech TEXT, -- napr. OLED, Liquid Retina
    common_faults JSONB DEFAULT '[]', -- Pole bežných chýb
    battery_risks TEXT, -- Špecifické riziká batérie a čipu
    frame_material TEXT, -- Materiál šasi
    negotiation_tips TEXT, -- Stratégia vyjednávania a checklisty
    full_report TEXT, -- Kompletný hĺbkový report (Forenzná analýza)
    base_price_recommended DECIMAL(10, 2), -- Odporúčaná trhová cena (Január 2026)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabuľka auditov (História vygenerovaných reportov pre používateľov)
DROP TABLE IF EXISTS audits CASCADE;
CREATE TABLE audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id INTEGER REFERENCES products(id),
    user_id UUID,
    status VARCHAR(50) DEFAULT 'completed',
    report_data JSONB NOT NULL,
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    final_price_recommendation DECIMAL(10, 2),
    view_count INTEGER DEFAULT 0,
    user_email TEXT, -- Pridané pre ukladanie auditov k emailu
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabuľka používateľov
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabuľka pre cachovanie trhových cien z externých zdrojov (Bazoš, Heureka)
CREATE TABLE IF NOT EXISTS market_prices (
    id SERIAL PRIMARY KEY,
    model VARCHAR(255) NOT NULL,
    storage VARCHAR(50),
    ram VARCHAR(50),
    color VARCHAR(50),
    price_from DECIMAL(10, 2),
    price_avg DECIMAL(10, 2),
    source VARCHAR(50),
    freshness_date VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model, storage, ram, color)
);

-- Indexy pre bleskové vyhľadávanie
CREATE INDEX idx_products_lookup ON products(brand, model_name);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_audits_user ON audits(user_id);

-- Trigger pre automatickú aktualizáciu timestampu
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
