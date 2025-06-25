-- src/config/data-migration-new.sql
-- Complete database migration with new structure

-- Drop existing tables if they exist
DROP TABLE IF EXISTS kyc_photos CASCADE;
DROP TABLE IF EXISTS kyc_applications CASCADE;
DROP TABLE IF EXISTS active_sessions CASCADE;
DROP TABLE IF EXISTS bot_instances CASCADE;
DROP TABLE IF EXISTS partners CASCADE;
DROP TABLE IF EXISTS banks CASCADE;
DROP TABLE IF EXISTS business_fields CASCADE;
DROP TABLE IF EXISTS provinces CASCADE;
DROP TABLE IF EXISTS cities CASCADE;

-- Create partners table first
CREATE TABLE partners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  bot_token VARCHAR(255) UNIQUE NOT NULL,
  api_secret VARCHAR(255) NOT NULL,
  webhook_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  rate_limit INTEGER DEFAULT 100,
  emeterai_client_id VARCHAR(255),
  emeterai_client_email VARCHAR(255),
  emeterai_client_password VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create bot instances table
CREATE TABLE bot_instances (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER REFERENCES partners(id) ON DELETE CASCADE,
  instance_id VARCHAR(255) UNIQUE NOT NULL,
  hostname VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  last_heartbeat TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create banks table
CREATE TABLE banks (
   id SERIAL PRIMARY KEY,
   bank_display VARCHAR(255) NOT NULL UNIQUE,
   bank_code VARCHAR(10) UNIQUE,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create business fields table
CREATE TABLE business_fields (
   id SERIAL PRIMARY KEY,
   name VARCHAR(255) NOT NULL UNIQUE,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create provinces table
CREATE TABLE provinces (
   code VARCHAR(10) PRIMARY KEY,
   name VARCHAR(255) NOT NULL
);

-- Create cities table
CREATE TABLE cities (
   code VARCHAR(10) PRIMARY KEY,
   name VARCHAR(255) NOT NULL,
   province_code VARCHAR(10) REFERENCES provinces(code)
);

-- Create active sessions table
CREATE TABLE active_sessions (
   id SERIAL PRIMARY KEY,
   partner_id INTEGER REFERENCES partners(id) ON DELETE CASCADE,
   telegram_id BIGINT NOT NULL,
   username VARCHAR(100),
   first_name VARCHAR(100),
   last_name VARCHAR(100),
   current_step VARCHAR(50) DEFAULT 'menu',
   form_data JSONB DEFAULT '{}',
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   CONSTRAINT unique_partner_telegram_session UNIQUE (partner_id, telegram_id)
);

-- Create main KYC applications table
CREATE TABLE kyc_applications (
   id SERIAL PRIMARY KEY,
   partner_id INTEGER REFERENCES partners(id) ON DELETE CASCADE,
   telegram_id BIGINT NOT NULL,
   username VARCHAR(100),
   first_name VARCHAR(100),
   last_name VARCHAR(100),

   -- Data dari OCR KTP
   full_name VARCHAR(200) NOT NULL,
   address TEXT NOT NULL,
   religion VARCHAR(50),
   occupation VARCHAR(200),
   postal_code VARCHAR(10),
   id_card_number VARCHAR(20) NOT NULL,
   
   -- Data manual input
   agent_name VARCHAR(200) NOT NULL,
   owner_name VARCHAR(200) NOT NULL,
   business_field VARCHAR(200) NOT NULL,
   pic_name VARCHAR(200) NOT NULL,
   pic_phone VARCHAR(20) NOT NULL,
   tax_number VARCHAR(20),
   account_holder_name VARCHAR(200) NOT NULL,
   bank_name VARCHAR(100) NOT NULL,
   account_number VARCHAR(50) NOT NULL,
   serial_number_edc BOOLEAN  VARCHAR(50),
   
   -- Location data
   province_code VARCHAR(10),
   province_name VARCHAR(255),
   city_code VARCHAR(10),
   city_name VARCHAR(255),
   
   tid VARCHAR(50),
   mid VARCHAR(50),
   mcc VARCHAR(10),
   
   status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'rejected')),
   remark TEXT,
   pdf_url TEXT,
   confirmed_by_name VARCHAR(200),
   confirmed_by_initial VARCHAR(10),
   confirmed_by_partner VARCHAR(200),
   admin_confirmed_at TIMESTAMP,
   admin_rejected_at TIMESTAMP,
   
   -- E-meterai integration
   emeterai_status VARCHAR(50) DEFAULT 'not_started',
   emeterai_transaction_id VARCHAR(255),
   emeterai_sn VARCHAR(255),
   stamped_pdf_url TEXT,
   stamped_by VARCHAR(255),
   stamped_at TIMESTAMP,
   user_emeterai_consent BOOLEAN DEFAULT NULL,
   
   -- Processing flags
   is_processed BOOLEAN DEFAULT FALSE,
   is_reviewed_by_artajasa BOOLEAN DEFAULT FALSE,
   google_drive_url TEXT,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   
   CONSTRAINT unique_partner_telegram_kyc UNIQUE (partner_id, telegram_id)
);

-- Create photos table
CREATE TABLE kyc_photos (
   id SERIAL PRIMARY KEY,
   partner_id INTEGER REFERENCES partners(id) ON DELETE CASCADE,
   application_id INTEGER REFERENCES kyc_applications(id) ON DELETE CASCADE,
   photo_type VARCHAR(50) NOT NULL,
   file_url VARCHAR(500) NOT NULL,
   file_name VARCHAR(200) NOT NULL,
   file_size INTEGER,
   uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   
   CONSTRAINT check_photo_type CHECK (photo_type IN ('location_photos', 'bank_book', 'id_card', 'signature'))
);

-- Create indexes
CREATE INDEX idx_active_sessions_partner_telegram ON active_sessions(partner_id, telegram_id);
CREATE INDEX idx_kyc_applications_partner ON kyc_applications(partner_id);
CREATE INDEX idx_kyc_applications_telegram_id ON kyc_applications(telegram_id);
CREATE INDEX idx_kyc_applications_id_card ON kyc_applications(id_card_number);
CREATE INDEX idx_kyc_applications_status ON kyc_applications(status);
CREATE INDEX idx_kyc_applications_processed ON kyc_applications(is_processed);
CREATE INDEX idx_kyc_applications_reviewed ON kyc_applications(is_reviewed_by_artajasa);
CREATE INDEX idx_kyc_applications_tid ON kyc_applications(tid);
CREATE INDEX idx_kyc_applications_mid ON kyc_applications(mid);
CREATE INDEX idx_kyc_photos_application_id ON kyc_photos(application_id);
CREATE INDEX idx_kyc_photos_type ON kyc_photos(photo_type);
CREATE INDEX idx_partners_active ON partners(is_active);
CREATE INDEX idx_partners_bot_token ON partners(bot_token) WHERE is_active = true;
CREATE INDEX idx_instances_partner_status ON bot_instances(partner_id, status);

-- Insert dummy data

-- Insert partners
INSERT INTO partners (name, bot_token, api_secret, is_active, rate_limit, ematerai_client_id, ematerai_client_email, ematerai_client_password) VALUES
('PT. Ekosistem Pasar Digital', '7710604689:AAGwjsvqT5vLUcBgZjFg4ZngINuksB6Boag', 'secret_key_123', true, 100, 'EPADI01', 'miftah@epadi.id', 'e06f8217');

-- Insert banks with codes
INSERT INTO banks (bank_display, bank_code) VALUES
('Bank Central Asia', '014'),
('Bank Mandiri', '008'),
('Bank Negara Indonesia', '009'),
('Bank Rakyat Indonesia', '002'),
('Bank CIMB Niaga', '022'),
('Bank Danamon', '011'),
('Bank Permata', '013'),
('Bank Syariah Indonesia', '451'),
('Bank Mega', '426'),
('Bank OCBC NISP', '028');

-- Insert business fields
INSERT INTO business_fields (name) VALUES
('Aktivitas Telekomunikasi dan perdagangan software'),
('Toko Kelontong'),
('Warung Makan'),
('Toko Elektronik'),
('Apotek'),
('Bengkel'),
('Laundry'),
('Toko Baju'),
('Toko Handphone'),
('Minimarket'),
('Fotocopy dan Printing'),
('Salon Kecantikan'),
('Barbershop'),
('Toko Spare Part'),
('Warung Kopi');

-- Insert provinces
INSERT INTO provinces (code, name) VALUES
('DPS', 'Bali'),
('0100', 'Jawa Barat'),
('0300', 'DKI Jakarta Raya'),
('0500', 'D.I. Yogyakarta'),
('0900', 'Jawa Tengah'),
('1200', 'Jawa Timur'),
('2300', 'Bengkulu'),
('3100', 'Jambi'),
('3200', 'D.I. Aceh'),
('3300', 'Sumatera Utara'),
('3400', 'Sumatera Barat'),
('3500', 'Riau'),
('3600', 'Sumatera Selatan'),
('3900', 'Lampung'),
('5100', 'Kalimantan Selatan'),
('5300', 'Kalimantan Barat'),
('5400', 'Kalimantan Timur'),
('5800', 'Kalimantan Tengah'),
('6000', 'Sulawesi Tengah'),
('6100', 'Sulawesi Selatan'),
('6200', 'Sulawesi Utara'),
('6900', 'Sulawesi Tenggara'),
('7100', 'Nusa Tenggara Barat'),
('7200', 'Bali'),
('7400', 'Nusa Tenggara Timur');

-- Insert cities
INSERT INTO cities (code, name, province_code) VALUES
('DENPASAR', 'Denpasar', 'DPS'),
('UBUD', 'Ubud', 'DPS'),
('SANUR', 'Sanur', 'DPS'),
('0101', 'Kab. Tangerang', '0100'),
('0102', 'Kab. Bekasi', '0100'),
('0103', 'Kab. Purwakarta', '0100'),
('0301', 'Jakarta Pusat', '0300'),
('0302', 'Jakarta Utara', '0300'),
('0303', 'Jakarta Barat', '0300'),
('0304', 'Jakarta Selatan', '0300'),
('0305', 'Jakarta Timur', '0300'),
('0501', 'Kota Yogyakarta', '0500'),
('0502', 'Sleman', '0500'),
('0503', 'Bantul', '0500');

CREATE INDEX idx_kyc_applications_partner_status ON kyc_applications(partner_id, status);
CREATE INDEX idx_kyc_photos_partner_application ON kyc_photos(partner_id, application_id);
CREATE INDEX idx_kyc_applications_created_at ON kyc_applications(created_at DESC);

