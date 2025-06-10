-- Drop existing tables if needed
DROP TABLE IF EXISTS kyc_photos CASCADE;
DROP TABLE IF EXISTS kyc_applications CASCADE;
DROP TABLE IF EXISTS active_sessions CASCADE;
DROP TABLE IF EXISTS banks CASCADE;
DROP TABLE IF EXISTS business_fields CASCADE;

-- Banks reference table
CREATE TABLE banks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Business fields reference table
CREATE TABLE business_fields (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Active sessions for ongoing registrations
CREATE TABLE active_sessions (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    current_step VARCHAR(50) DEFAULT 'menu',
    form_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main KYC applications
CREATE TABLE kyc_applications (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),

    -- Form fields
    agent_name VARCHAR(200) NOT NULL,
    agent_address TEXT NOT NULL,
    owner_name VARCHAR(200) NOT NULL,
    business_field VARCHAR(200) NOT NULL,
    pic_name VARCHAR(200) NOT NULL,
    pic_phone VARCHAR(20) NOT NULL,
    id_card_number VARCHAR(20) UNIQUE NOT NULL,
    tax_number VARCHAR(20), -- Optional NPWP
    account_holder_name VARCHAR(200) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    signature_initial VARCHAR(10) NOT NULL,

    -- System fields
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'rejected')),
    remark TEXT NULL,
    pdf_url TEXT NULL,

    -- Admin confirmation info
    confirmed_by_name VARCHAR(200),
    confirmed_by_initial VARCHAR(10),
    confirmed_by_partner VARCHAR(200),
    admin_confirmed_at TIMESTAMP,
    admin_rejected_at TIMESTAMP,

    -- E-meterai fields
    emeterai_status VARCHAR(50) DEFAULT 'not_started',
    emeterai_transaction_id VARCHAR(255),
    emeterai_token TEXT,
    emeterai_token_expires TIMESTAMP,
    emeterai_sn VARCHAR(255),
    stamped_pdf_url TEXT,
    stamped_by VARCHAR(255),
    stamped_at TIMESTAMP,
    user_emeterai_consent BOOLEAN DEFAULT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Photos storage (using CDN URLs)
CREATE TABLE kyc_photos (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES kyc_applications(id) ON DELETE CASCADE,
    photo_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500) NOT NULL, -- CDN URLs
    file_name VARCHAR(200) NOT NULL,
    file_size INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_photo_type CHECK (photo_type IN ('location_photos', 'bank_book', 'id_card'))
);

-- Indexes
CREATE INDEX idx_active_sessions_telegram_id ON active_sessions(telegram_id);
CREATE INDEX idx_kyc_applications_telegram_id ON kyc_applications(telegram_id);
CREATE INDEX idx_kyc_applications_id_card ON kyc_applications(id_card_number);
CREATE INDEX idx_kyc_applications_status ON kyc_applications(status);
CREATE INDEX idx_kyc_photos_application_id ON kyc_photos(application_id);
CREATE INDEX idx_kyc_photos_type ON kyc_photos(photo_type);

-- Insert sample banks
INSERT INTO banks (name) VALUES
('Bank Central Asia'),
('Bank Mandiri'),
('Bank Negara Indonesia'),
('Bank Rakyat Indonesia'),
('Bank CIMB Niaga'),
('Bank Danamon'),
('Bank Permata'),
('Bank Syariah Indonesia'),
('Bank Mega'),
('Bank OCBC NISP');

-- Insert sample business fields
INSERT INTO business_fields (name) VALUES
('Toko Kelontong'),
('Warung Makan'),
('Toko Elektronik'),
('Apotek'),
('Bengkel'),
('Salon/Barbershop'),
('Laundry'),
('Toko Baju'),
('Toko Handphone'),
('Minimarket');