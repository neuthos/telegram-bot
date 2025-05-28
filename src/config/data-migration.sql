DROP TABLE IF EXISTS registered_sessions;
DROP TABLE IF EXISTS active_sessions;

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

CREATE TABLE registered_sessions (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    nama VARCHAR(200) NOT NULL,
    nomor_telepon VARCHAR(20) NOT NULL,
    nomor_ktp VARCHAR(20) UNIQUE NOT NULL,
    alamat TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_active_sessions_telegram_id ON active_sessions(telegram_id);
CREATE INDEX idx_registered_sessions_telegram_id ON registered_sessions(telegram_id);
CREATE INDEX idx_registered_sessions_ktp ON registered_sessions(nomor_ktp);
CREATE INDEX idx_registered_sessions_status ON registered_sessions(status);
