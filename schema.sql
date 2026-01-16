-- SQL Schéma pre Auditlyio
-- Databáza: PostgreSQL

-- Povolenie rozšírenia pre UUID (voliteľné, ak chceme UUID ako primárne kľúče)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabuľka pre kategórie (ak by sme ich chceli mať v samostatnej tabuľke, 
-- ale v zadaní stačí pole v tabuľke products)
CREATE TYPE product_category AS ENUM ('Mobile', 'Console', 'Laptop');

-- Tabuľka produktov
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    model_name VARCHAR(100),
    category product_category NOT NULL,
    display_tech VARCHAR(100), -- napr. OLED, Liquid Retina, AMOLED
    common_faults JSONB DEFAULT '[]', -- Pole bežných chýb (napr. ["Ghosting", "Battery degradation"])
    battery_risks TEXT, -- Špecifické riziká batérie
    frame_material VARCHAR(100), -- napr. Titanium, Aluminum, Stainless Steel
    negotiation_tips TEXT, -- Tipy na vyjednávanie o cene
    base_price_recommended DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME_ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME_ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabuľka auditov (vygenerované reporty)
CREATE TABLE audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id INTEGER REFERENCES products(id),
    user_id UUID, -- Referencia na používateľa, ak existuje systém prihlásenia
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
    report_data JSONB NOT NULL, -- Kompletný vygenerovaný report (technické detaily, checklist, cena)
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    final_price_recommendation DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME_ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexy pre rýchlejšie vyhľadávanie
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_audits_product_id ON audits(product_id);

-- Vzorové dáta
INSERT INTO products (name, brand, model_name, category, display_tech, common_faults, battery_risks, frame_material, negotiation_tips, base_price_recommended)
VALUES 
('iPhone 13 Pro', 'Apple', 'iPhone 13 Pro', 'Mobile', 'Super Retina XDR OLED', '["Yellow screen tint", "Charging port looseness"]', 'Fast degradation if fast charged daily', 'Stainless Steel', 'Look for scratches on the frame, check battery health below 85%', 650.00),
('PlayStation 5', 'Sony', 'PS5 Disk Edition', 'Console', 'N/A', '["Stick drift on DualSense", "Overheating due to dust"]', 'N/A', 'Plastic/Plastic Composite', 'Check if it comes with original cables and if the controller is not drifting', 400.00),
('MacBook Air M2', 'Apple', 'M2 2022', 'Laptop', 'Liquid Retina', '["Keyboard marks on screen", "Hinge looseness"]', 'Swelling after 500 cycles', 'Aluminum', 'Check for dents on corners as they impact resale value significantly', 950.00);

-- Tabuľka pre cachovanie trhových cien (z Bing/Heureka)
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
    updated_at TIMESTAMP WITH TIME_ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model, storage, ram, color)
);

-- Tabuľka pre históriu auditov iPhonov
CREATE TABLE IF NOT EXISTS iphone_audits (
    id SERIAL PRIMARY KEY,
    model VARCHAR(255) NOT NULL,
    capacity VARCHAR(50),
    color VARCHAR(50),
    condition_pct INTEGER,
    battery_health INTEGER,
    calculated_price DECIMAL(10, 2),
    market_avg_at_time DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME_ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabuľka pre historický archív cien (pre grafy a AI predpovede)
CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    model VARCHAR(255) NOT NULL,
    storage VARCHAR(50),
    ram VARCHAR(50),
    color VARCHAR(50),
    price_from DECIMAL(10, 2),
    price_avg DECIMAL(10, 2),
    source VARCHAR(50),
    recorded_at TIMESTAMP WITH TIME_ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pre rýchle generovanie grafov časových radov
CREATE INDEX IF NOT EXISTS idx_price_history_lookup ON price_history(model, storage, color, recorded_at);
