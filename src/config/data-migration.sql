-- Drop existing tables if needed
DROP TABLE IF EXISTS kyc_photos CASCADE;
DROP TABLE IF EXISTS kyc_applications CASCADE;
DROP TABLE IF EXISTS active_sessions CASCADE;

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
    
    -- Form fields following the order
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
    
    -- System fields
    confirm_date TIMESTAMP,
    signature_initial VARCHAR(10) NOT NULL,
    signature_photo_path VARCHAR(500), -- Optional signature photo
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Photos storage
CREATE TABLE kyc_photos (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES kyc_applications(id) ON DELETE CASCADE,
    photo_type VARCHAR(50) NOT NULL, -- location_photos, bank_book, id_card, signature
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(200) NOT NULL,
    file_size INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_active_sessions_telegram_id ON active_sessions(telegram_id);
CREATE INDEX idx_kyc_applications_telegram_id ON kyc_applications(telegram_id);
CREATE INDEX idx_kyc_applications_id_card ON kyc_applications(id_card_number);
CREATE INDEX idx_kyc_applications_status ON kyc_applications(status);
CREATE INDEX idx_kyc_photos_application_id ON kyc_photos(application_id);
CREATE INDEX idx_kyc_photos_type ON kyc_photos(photo_type);

-- Add constraints
ALTER TABLE kyc_photos ADD CONSTRAINT check_photo_type 
CHECK (photo_type IN ('location_photos', 'bank_book', 'id_card', 'signature'));