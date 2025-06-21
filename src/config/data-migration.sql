
DROP TABLE IF EXISTS kyc_photos CASCADE;
DROP TABLE IF EXISTS kyc_applications CASCADE;
DROP TABLE IF EXISTS active_sessions CASCADE;
DROP TABLE IF EXISTS banks CASCADE;
DROP TABLE IF EXISTS business_fields CASCADE;
DROP TABLE IF EXISTS provinces CASCADE;
DROP TABLE IF EXISTS cities CASCADE;


CREATE TABLE banks (
    id SERIAL PRIMARY KEY,
    bank_display VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE business_fields (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


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



CREATE TABLE provinces (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE cities (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    province_code VARCHAR(10) REFERENCES provinces(code)
);



CREATE TABLE kyc_applications (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),

    
    agent_name VARCHAR(200) NOT NULL,
    agent_address TEXT NOT NULL,
    owner_name VARCHAR(200) NOT NULL,
    business_field VARCHAR(200) NOT NULL,
    pic_name VARCHAR(200) NOT NULL,
    pic_phone VARCHAR(20) NOT NULL,
    id_card_number VARCHAR(20) UNIQUE NOT NULL,
    tax_number VARCHAR(20), 
    account_holder_name VARCHAR(200) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    signature_initial VARCHAR(10) NOT NULL,

    province_code VARCHAR(10),
    province_name VARCHAR(255),
    city_code VARCHAR(10),
    city_name VARCHAR(255),


    
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'rejected')),
    remark TEXT NULL,
    pdf_url TEXT NULL,

    
    confirmed_by_name VARCHAR(200),
    confirmed_by_initial VARCHAR(10),
    confirmed_by_partner VARCHAR(200),
    admin_confirmed_at TIMESTAMP,
    admin_rejected_at TIMESTAMP,

    
    emeterai_status VARCHAR(50) DEFAULT 'not_started',
    emeterai_transaction_id VARCHAR(255),
    emeterai_token TEXT,
    emeterai_token_expires TIMESTAMP,
    emeterai_sn VARCHAR(255),
    stamped_pdf_url TEXT,
    stamped_by VARCHAR(255),
    stamped_at TIMESTAMP,
    user_emeterai_consent BOOLEAN DEFAULT NULL,
    is_processed BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE kyc_photos (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES kyc_applications(id) ON DELETE CASCADE,
    photo_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500) NOT NULL, 
    file_name VARCHAR(200) NOT NULL,
    file_size INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_photo_type CHECK (photo_type IN ('location_photos', 'bank_book', 'id_card'))
);


CREATE INDEX idx_active_sessions_telegram_id ON active_sessions(telegram_id);
CREATE INDEX idx_kyc_applications_telegram_id ON kyc_applications(telegram_id);
CREATE INDEX idx_kyc_applications_id_card ON kyc_applications(id_card_number);
CREATE INDEX idx_kyc_applications_status ON kyc_applications(status);
CREATE INDEX idx_kyc_photos_application_id ON kyc_photos(application_id);
CREATE INDEX idx_kyc_photos_type ON kyc_photos(photo_type);



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


CREATE TABLE bot_instances (
   id SERIAL PRIMARY KEY,
   partner_id INTEGER REFERENCES partners(id) ON DELETE CASCADE,
   instance_id VARCHAR(255) UNIQUE NOT NULL,
   hostname VARCHAR(255),
   status VARCHAR(50) DEFAULT 'active',
   last_heartbeat TIMESTAMP,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE active_sessions 
ADD COLUMN partner_id INTEGER REFERENCES partners(id) ON DELETE CASCADE,
ADD CONSTRAINT unique_partner_telegram UNIQUE (partner_id, telegram_id);


ALTER TABLE kyc_applications 
ADD COLUMN partner_id INTEGER REFERENCES partners(id) ON DELETE CASCADE,
DROP COLUMN emeterai_token,
DROP COLUMN emeterai_token_expires;


ALTER TABLE kyc_photos
ADD COLUMN partner_id INTEGER REFERENCES partners(id) ON DELETE CASCADE;


CREATE INDEX idx_partners_active ON partners(is_active);
CREATE INDEX idx_partners_bot_token ON partners(bot_token) WHERE is_active = true;
CREATE INDEX idx_sessions_partner_telegram ON active_sessions(partner_id, telegram_id);
CREATE INDEX idx_applications_partner ON kyc_applications(partner_id);
CREATE INDEX idx_applications_partner_status ON kyc_applications(partner_id, status);
CREATE INDEX idx_photos_partner_application ON kyc_photos(partner_id, application_id);
CREATE INDEX idx_instances_partner_status ON bot_instances(partner_id, status);



INSERT INTO banks (bank_display) VALUES
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


INSERT INTO business_fields (name) VALUES
('Toko Kelontong'),
('Warung Makan'),
('Toko Elektronik'),
('Apotek'),
('Bengkel'),
('Laundry'),
('Toko Baju'),
('Toko Handphone'),
('Minimarket');




INSERT INTO provinces (code, name) VALUES
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
('7400', 'Nusa Tenggara Timur'),
('7500', 'Timor Timur'),
('8100', 'Maluku'),
('8200', 'Irian Jaya'),
('8300', 'Maluku Utara'),
('9900', 'DI LUAR INDONESIA');



INSERT INTO cities (code, name, province_code) VALUES
('0101', 'Kab. Tangerang', '0100'),
('0102', 'Kab. Bekasi', '0100'),
('0103', 'Kab. Purwakarta', '0100'),
('0104', 'Kab. Serang', '0100'),
('0105', 'Kab. Pandeglang', '0100'),
('0106', 'Kab. Karawang', '0100'),
('0107', 'Kab. Lebak', '0100'),
('0108', 'Kab. Bogor', '0100'),
('0109', 'Kab. Sukabumi', '0100'),
('0110', 'Kab. Cianjur', '0100'),
('0111', 'Kab. Bandung', '0100'),
('0112', 'Kab. Sumedang', '0100'),
('0113', 'Kab. Tasikmalaya', '0100'),
('0114', 'Kab. Garut', '0100'),
('0115', 'Kab. Ciamis', '0100'),
('0116', 'Kab. Cirebon', '0100'),
('0117', 'Kab. Kuningan', '0100'),
('0118', 'Kab. Indramayu', '0100'),
('0119', 'Kab. Majalengka', '0100'),
('0121', 'Kab. Subang', '0100'),
('0122', 'Kab Bandung Barat', '0100'),
('0180', 'Kotif Banjar', '0100'),
('0190', 'Kotif Cilegon', '0100'),
('0191', 'Kodya Bandung', '0100'),
('0192', 'Kodya Bogor', '0100'),
('0193', 'Kodya Sukabumi', '0100'),
('0194', 'Kodya Cirebon', '0100'),
('0195', 'Kotif Tasikmalaya', '0100'),
('0196', 'Kotif Cimahi', '0100'),
('0197', 'Kotif Depok', '0100'),
('0198', 'Kotif Bekasi', '0100'),
('0199', 'Kodya Tangerang', '0100'),


('0391', 'Wil. Kota Jakarta Pusat', '0300'),
('0392', 'Wil. Kota Jakarta Utara', '0300'),
('0393', 'Wil. Kota Jakarta Barat', '0300'),
('0394', 'Wil. Kota Jakarta Selatan', '0300'),
('0395', 'Wil. Kota Jakarta Timur', '0300'),


('0501', 'Kab. Bantul', '0500'),
('0502', 'Kab. Sleman', '0500'),
('0503', 'Kab. Gunung Kidul', '0500'),
('0504', 'Kab. Kulon Progo', '0500'),
('0591', 'Kodya Yogyakarta', '0500'),


('0901', 'Kab. Semarang', '0900'),
('0902', 'Kab. Kendal', '0900'),
('0903', 'Kab. Demak', '0900'),
('0904', 'Kab. Grobogan', '0900'),
('0905', 'Kab. Pekalongan', '0900'),
('0906', 'Kab. Tegal', '0900'),
('0907', 'Kab. Brebes', '0900'),
('0908', 'Kab. Pati', '0900'),
('0909', 'Kab. Kudus', '0900'),
('0910', 'Kab. Pemalang', '0900'),
('0911', 'Kab. Jepara', '0900'),
('0912', 'Kab. Rembang', '0900'),
('0913', 'Kab. Blora', '0900'),
('0914', 'Kab. Banyumas', '0900'),
('0915', 'Kab. Cilacap', '0900'),
('0916', 'Kab. Purbalingga', '0900'),
('0917', 'Kab. Banjarnegara', '0900'),
('0918', 'Kab. Magelang', '0900'),
('0919', 'Kab. Temanggung', '0900'),
('0920', 'Kab. Wonosobo', '0900'),
('0921', 'Kab. Purworejo', '0900'),
('0922', 'Kab. Kebumen', '0900'),
('0923', 'Kab. Klaten', '0900'),
('0924', 'Kab. Boyolali', '0900'),
('0925', 'Kab. Sragen', '0900'),
('0926', 'Kab. Sukoharjo', '0900'),
('0927', 'Kab. Karanganyar', '0900'),
('0928', 'Kab. Wonogiri', '0900'),
('0929', 'Kab. Batang', '0900'),
('0991', 'Kodya Semarang', '0900'),
('0992', 'Kodya Salatiga', '0900'),
('0993', 'Kodya Pekalongan', '0900'),
('0994', 'Kodya Tegal', '0900'),
('0995', 'Kodya Magelang', '0900'),
('0996', 'Kodya Surakarta', '0900'),
('0997', 'Kotif Klaten', '0900'),
('0998', 'Kotif Cilacap', '0900'),
('0999', 'Kotif Purwokerto', '0900'),


('1201', 'Kab. Gresik', '1200'),
('1202', 'Kab. Sidoarjo', '1200'),
('1203', 'Kab. Mojokerto', '1200'),
('1204', 'Kab. Jombang', '1200'),
('1205', 'Kab. Sampang', '1200'),
('1206', 'Kab. Pamekasan', '1200'),
('1207', 'Kab. Sumenep', '1200'),
('1208', 'Kab. Bangkalan', '1200'),
('1209', 'Kab. Bondowoso', '1200'),
('1211', 'Kab. Banyuwangi', '1200'),
('1212', 'Kab. Jember', '1200'),
('1213', 'Kab. Malang', '1200'),
('1214', 'Kab. Pasuruan', '1200'),
('1215', 'Kab. Probolinggo', '1200'),
('1216', 'Kab. Lumajang', '1200'),
('1217', 'Kab. Kediri', '1200'),
('1218', 'Kab. Nganjuk', '1200'),
('1219', 'Kab. Tulungagung', '1200'),
('1220', 'Kab. Trenggalek', '1200'),
('1221', 'Kab. Blitar', '1200'),
('1222', 'Kab. Madiun', '1200'),
('1223', 'Kab. Ngawi', '1200'),
('1224', 'Kab. Magetan', '1200'),
('1225', 'Kab. Ponorogo', '1200'),
('1226', 'Kab. Pacitan', '1200'),
('1227', 'Kab. Bojonegoro', '1200'),
('1228', 'Kab. Tuban', '1200'),
('1229', 'Kab. Lamongan', '1200'),
('1230', 'Kab. Situbondo', '1200'),
('1291', 'Kodya Surabaya', '1200'),
('1292', 'Kodya Mojokerto', '1200'),
('1293', 'Kodya Malang', '1200'),
('1294', 'Kodya Pasuruan', '1200'),
('1295', 'Kodya Probolinggo', '1200'),
('1296', 'Kodya Blitar', '1200'),
('1297', 'Kodya Kediri', '1200'),
('1298', 'Kodya Madiun', '1200'),
('1299', 'Kotif Jember', '1200'),


('2301', 'Kab. Bengkulu Selatan', '2300'),
('2302', 'Kab. Bengkulu Utara', '2300'),
('2303', 'Kab. Rejang Lebong', '2300'),
('2391', 'Kodya Bengkulu', '2300'),


('3101', 'Kab. Batanghari', '3100'),
('3104', 'Kab. Sarolangun', '3100'),
('3105', 'Kab. Kerinci', '3100'),
('3106', 'Kab. Muara Jambi', '3100'),
('3107', 'Kab. Tanjung Jabung Barat', '3100'),
('3108', 'Kab. Tanjung Jabung Timur', '3100'),
('3109', 'Kab. Tebo', '3100'),
('3110', 'Kab. Bungo', '3100'),
('3111', 'Kab. Marangin', '3100'),
('3191', 'Kodya Jambi', '3100'),


('3201', 'Kab. Aceh Besar', '3200'),
('3202', 'Kab. Pidie', '3200'),
('3203', 'Kab. Aceh Utara', '3200'),
('3204', 'Kab. Aceh Timur', '3200'),
('3205', 'Kab. Aceh Selatan', '3200'),
('3206', 'Kab. Aceh Barat', '3200'),
('3207', 'Kab. Aceh Tengah', '3200'),
('3208', 'Kab. Aceh Tenggara', '3200'),
('3209', 'Kab. Aceh Singkil', '3200'),
('3210', 'Kab. Aceh Jeumpa', '3200'),
('3291', 'Kodya Banda Aceh', '3200'),
('3292', 'Kodya Sabang', '3200'),
('3293', 'Kotif Lhokseumawe', '3200'),
('3294', 'Kotif Langsa', '3200'),
('3295', 'Kotif Simeulue', '3200'),


('3301', 'Kab. Deli Serdang', '3300'),
('3302', 'Kab. Langkat', '3300'),
('3303', 'Kab. Karo', '3300'),
('3304', 'Kab. Simalungun', '3300'),
('3305', 'Kab. Labuhan Batu', '3300'),
('3306', 'Kab. Asahan', '3300'),
('3307', 'Kab. Dairi', '3300'),
('3308', 'Kab. Tapanuli Utara', '3300'),
('3309', 'Kab. Tapanuli Tengah', '3300'),
('3310', 'Kab. Tapanuli Selatan', '3300'),
('3311', 'Kab. Nias', '3300'),
('3312', 'Kotif Rantau Prapat', '3300'),
('3313', 'Kab. Toba Samosir', '3300'),
('3314', 'Kab. Mandailing Natal', '3300'),
('3391', 'Kodya Tebing Tinggi', '3300'),
('3392', 'Kodya Binjai', '3300'),
('3393', 'Kodya Pematang Siantar', '3300'),
('3394', 'Kodya Tanjung Balai', '3300'),
('3395', 'Kodya Sibolga', '3300'),
('3396', 'Kodya Medan', '3300'),
('3398', 'Kotif Kisaran', '3300'),
('3399', 'Kotif Padang Sidempuan', '3300'),


('3401', 'Kab. Agam', '3400'),
('3402', 'Kab. Pasaman', '3400'),
('3403', 'Kab. Limapuluh Koto', '3400'),
('3404', 'Kab. Solok', '3400'),
('3405', 'Kab. Padang Pariaman', '3400'),
('3406', 'Kab. Pesisir Selatan', '3400'),
('3407', 'Kab. Tanah Datar', '3400'),
('3408', 'Kab. Sawahlunto Sijunjung', '3400'),
('3409', 'Kab. Mentawai', '3400'),
('3491', 'Kodya Bukittinggi', '3400'),
('3492', 'Kodya Padang', '3400'),
('3493', 'Kodya Sawahlunto', '3400'),
('3494', 'Kodya Padangpanjang', '3400'),
('3495', 'Kodya Solok', '3400'),
('3496', 'Kodya Payakumbuh', '3400'),
('3497', 'Kotif Pariaman', '3400'),


('3501', 'Kab. Kampar', '3500'),
('3502', 'Kab. Bengkalis', '3500'),
('3503', 'Kab. Riau Kepulauan', '3500'),
('3504', 'Kab. Indragiri Hulu', '3500'),
('3505', 'Kab. Indragiri Hilir', '3500'),
('3506', 'Kab. Karimun', '3500'),
('3507', 'Kab. Natuna', '3500'),
('3508', 'Kab. Rokan Hulu', '3500'),
('3509', 'Kab. Rokan Hilir', '3500'),
('3510', 'Kab. Palalawan', '3500'),
('3511', 'Kab. Siak', '3500'),
('3512', 'Kab. Kuantan Singingi', '3500'),
('3591', 'Kodya Pekanbaru', '3500'),
('3592', 'Kotif Dumai', '3500'),
('3593', 'Kotif Tanjungpinang', '3500'),
('3594', 'Kotif Pulau Batam', '3500'),


('3604', 'Kab. Belitung', '3600'),
('3605', 'Kab. Bangka', '3600'),
('3606', 'Kab. Musi Banyuasin', '3600'),
('3607', 'Kab. Ogan Komering Ulu', '3600'),
('3608', 'Kab. Lematang Ilir Ogan Tengah', '3600'),
('3609', 'Kab. Lahat', '3600'),
('3610', 'Kab. Musi Rawas', '3600'),
('3611', 'Kab. Ogan Komering Ilir', '3600'),
('3612', 'Kab. Muara Enim', '3600'),
('3691', 'Kodya Palembang', '3600'),
('3692', 'Kodya Pangkal Pinang', '3600'),
('3693', 'Kotif Lubuklinggau', '3600'),
('3694', 'Kotif Prabumulih', '3600'),
('3695', 'Kotif Baturaja', '3600'),
('3697', 'Kotif Pagar Alam', '3600'),


('3901', 'Kab.Lampung Selatan', '3900'),
('3902', 'Kab. Lampung Tengah', '3900'),
('3903', 'Kab. Lampung Utara', '3900'),
('3904', 'Kab. Lampung Barat', '3900'),
('3905', 'Kab. Tulang Bawang', '3900'),
('3906', 'Kab. Tanggamus', '3900'),
('3907', 'Kab. Lampung Timur', '3900'),
('3908', 'Kab. Way Kanan', '3900'),
('3991', 'Kodya Bandar Lampung', '3900'),
('3992', 'Kotif Metro', '3900'),


('5101', 'Kab. Banjar', '5100'),
('5102', 'Kab. Tanah Laut', '5100'),
('5103', 'Kab. Tapin', '5100'),
('5104', 'Kab. Hulu Sungai Selatan', '5100'),
('5105', 'Kab. Hulu Sungai Tengah', '5100'),
('5106', 'Kab. Hulu Sungai Utara', '5100'),
('5107', 'Kab. Barito Kuala', '5100'),
('5108', 'Kab. Kota Baru', '5100'),
('5109', 'Kab. Tabalong', '5100'),
('5110', 'Kab. Tanah Bumbu', '5100'),
('5191', 'Kodya Banjarmasin', '5100'),
('5192', 'Kotif Banjarbaru', '5100'),


('5301', 'Kab. Pontianak', '5300'),
('5302', 'Kab. Sambas', '5300'),
('5303', 'Kab. Ketapang', '5300'),
('5304', 'Kab. Sanggau', '5300'),
('5305', 'Kab. Sintang', '5300'),
('5306', 'Kab. Kapuas Hulu', '5300'),
('5307', 'Kab. Bengkayang', '5300'),
('5308', 'Kab. Landak', '5300'),
('5391', 'Kodya Pontianak', '5300'),
('5392', 'Kotif Singkawang', '5300'),


('5401', 'Kab. Kutai', '5400'),
('5402', 'Kab. Berau', '5400'),
('5403', 'Kab. Tanah Pasir', '5400'),
('5404', 'Kab. Bulungan', '5400'),
('5405', 'Kab. Kutai Barat', '5400'),
('5406', 'Kab. Kutai Timur', '5400'),
('5407', 'Kab. Bulungan Selatan', '5400'),
('5408', 'Kab. Bulungan Utara', '5400'),
('5409', 'Kab. Nunukan', '5400'),
('5410', 'Kab. Penajem Paser Utara', '5400'),
('5491', 'Kodya Samarinda', '5400'),
('5492', 'Kodya Balikpapan', '5400'),
('5493', 'Kotif Tarakan', '5400'),
('5494', 'Kotif Bontang', '5400'),
('5495', 'Kab. Malinau', '5400'),


('5801', 'Kab. Kapuas', '5800'),
('5803', 'Kab. Kotawaringin Barat', '5800'),
('5804', 'Kab. Kotawaringin Timur', '5800'),
('5806', 'Kab. Barito Selatan', '5800'),
('5808', 'Kab. Barito Utara', '5800'),
('5892', 'Kodya Palangkaraya', '5800'),


('6001', 'Kab. Donggala', '6000'),
('6002', 'Kab. Poso', '6000'),
('6003', 'Kab. Banggai', '6000'),
('6004', 'Kab. Toli-toli', '6000'),
('6005', 'Kab. Banggai Kepulauan', '6000'),
('6006', 'Kab. Morowali', '6000'),
('6007', 'Kab. Buol', '6000'),
('6091', 'Kotif Palu', '6000'),


('6101', 'Kab. Pinrang', '6100'),
('6102', 'Kab. Gowa', '6100'),
('6103', 'Kab. Wajo', '6100'),
('6104', 'Kab. Mamuju', '6100'),
('6105', 'Kab. Bone', '6100'),
('6106', 'Kab. Tana Toraja', '6100'),
('6107', 'Kab. Maros', '6100'),
('6108', 'Kab. Majene', '6100'),
('6109', 'Kab. Luwu', '6100'),
('6110', 'Kab. Sinjai', '6100'),
('6111', 'Kab. Bulukumba', '6100'),
('6112', 'Kab. Bantaeng', '6100'),
('6113', 'Kab. Jeneponto', '6100'),
('6114', 'Kab. Selayar', '6100'),
('6115', 'Kab. Takalar', '6100'),
('6116', 'Kab. Barru', '6100'),
('6117', 'Kab. Sidenreng Rappang', '6100'),
('6118', 'Kab. Pangkajene Kepulauan', '6100'),
('6119', 'Kab. Soppeng', '6100'),
('6120', 'Kab. Polewali Mamasa', '6100'),
('6121', 'Kab. Enrekang', '6100'),
('6122', 'Kab. Luwu Selatan', '6100'),
('6191', 'Kodya Ujungpandang', '6100'),
('6192', 'Kodya Pare-pare', '6100'),
('6193', 'Kotif Palopo', '6100'),
('6194', 'Kotif Watampone', '6100'),


('6201', 'Kab. Gorontalo', '6200'),
('6202', 'Kab. Minahasa', '6200'),
('6203', 'Kab. Bolaang Mongondow', '6200'),
('6204', 'Kab. Sangihe Talaud', '6200'),
('6206', 'Kab. Bualemo', '6200'),
('6211', 'Kab. Ruwato', '6200'),
('6291', 'Kodya Manado', '6200'),
('6292', 'Kodya Gorontalo', '6200'),
('6293', 'Kodya Bitung', '6200'),


('6901', 'Kab. Buton', '6900'),
('6902', 'Kab. Kendari', '6900'),
('6903', 'Kab. Muna', '6900'),
('6904', 'Kab. Kolaka', '6900'),
('6990', 'Kotif Bau-bau', '6900'),
('6991', 'Kotif Kendari', '6900'),


('7101', 'Kab. Lombok Barat', '7100'),
('7102', 'Kab. Lombok Tengah', '7100'),
('7103', 'Kab. Lombok Timur', '7100'),
('7104', 'Kab. Sumbawa', '7100'),
('7105', 'Kab. Bima', '7100'),
('7106', 'Kab. Dompu', '7100'),
('7191', 'Kodya Mataram', '7100'),


('7201', 'Kab. Buleleng', '7200'),
('7202', 'Kab. Jembrana', '7200'),
('7203', 'Kab. Tabanan', '7200'),
('7204', 'Kab. Badung', '7200'),
('7205', 'Kab. Gianyar', '7200'),
('7206', 'Kab. Klungkung', '7200'),
('7207', 'Kab. Bangli', '7200'),
('7208', 'Kab. Karangasem', '7200'),
('7291', 'Kodya Denpasar', '7200'),


('7401', 'Kab. Kupang', '7400'),
('7402', 'Kab. Timor-Tengah Selatan', '7400'),
('7403', 'Kab. Timor-Tengah Utara', '7400'),
('7404', 'Kab. Belu', '7400'),
('7405', 'Kab. Alor', '7400'),
('7406', 'Kab. Alor', '7400'),
('7407', 'Kab. Sikka', '7400'),
('7408', 'Kab. Ende', '7400'),
('7409', 'Kab. Ngada', '7400'),
('7410', 'Kab. Manggarai', '7400'),
('7411', 'Kab. Sumba Timur', '7400'),
('7412', 'Kab. Sumba Barat', '7400'),
('7413', 'Kab. Lawoleba', '7400'),
('7491', 'Kotif Kupang', '7400'),


('7501', 'Kab. Dili', '7500'),
('7502', 'Kab. Baucau', '7500'),
('7503', 'Kab. Manatuto', '7500'),
('7504', 'Kab. Lautem / Lospalos', '7500'),
('7505', 'Kab. Viqueque', '7500'),
('7506', 'Kab. Ainaro', '7500'),
('7507', 'Kab. Manufahi / Same', '7500'),
('7508', 'Kab. Cova-Lima / Suai', '7500'),
('7509', 'Kab. Ambeno / Pantai Makasar', '7500'),
('7510', 'Kab. Bobonaro / Mahana', '7500'),
('7511', 'Kab. Liquica', '7500'),
('7512', 'Kab. Ermera', '7500'),
('7513', 'Kab. Aileu', '7500'),
('7590', 'Kotif Dili', '7500'),


('8101', 'Kab. Maluku Tengah', '8100'),
('8102', 'Kab. Maluku Tenggara', '8100'),
('8191', 'Kodya Ambon', '8100'),


('8201', 'Kab. Jayapura', '8200'),
('8202', 'Kab.Tlk Cendrawasih/Biak Numfor', '8200'),
('8204', 'Kab. Sorong', '8200'),
('8205', 'Kab. Fak-Fak', '8200'),
('8209', 'Kab. Manokwari', '8200'),
('8210', 'Kab. Yapen-Waropen', '8200'),
('8211', 'Kab. Merauke', '8200'),
('8212', 'Kab. Paniai', '8200'),
('8213', 'Kab. Jayawijaya', '8200'),
('8214', 'Kab. Nabire', '8200'),
('8215', 'Kab. Mimika', '8200'),
('8216', 'Kab. Puncak Jaya', '8200'),
('8291', 'Kotif Jayapura', '8200'),
('8292', 'Kodya Sorong', '8200'),


('8301', 'Kab. maluku Utara', '8300'),
('8302', 'Kab. Halmahera Tengah', '8300'),
('8390', 'Kotif ternate', '8300'),


('9999', 'DI LUAR INDONESIA', '9900');