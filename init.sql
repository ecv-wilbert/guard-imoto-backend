-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cleanup (In reverse order of dependencies to avoid FK errors)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS detections CASCADE;
DROP TABLE IF EXISTS rfid_history CASCADE;
DROP TABLE IF EXISTS battery_history CASCADE;
DROP TABLE IF EXISTS gyro_history CASCADE;
DROP TABLE IF EXISTS gps_history CASCADE;
DROP TABLE IF EXISTS nfc_tags CASCADE;
DROP TABLE IF EXISTS device_config CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS user_fcm_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_uid TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  photo_url TEXT,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. USER FCM TOKENS
CREATE TABLE user_fcm_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, fcm_token)
);

-- 3. DEVICES (Updated with serial_number, Secret Hash, and Status)
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Identity
  serial_number TEXT NOT NULL UNIQUE,   -- Physical hardware identifier
  device_name TEXT NOT NULL,
  device_color TEXT,
  pubnub_channel TEXT NOT NULL UNIQUE,
  
  -- Security & State
  device_secret_hash TEXT,              -- For secure device-to-cloud auth
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  paired BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. DEVICE CONFIGURATION
CREATE TABLE device_config (
  device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  relay1_enabled BOOLEAN NOT NULL DEFAULT false,
  relay1_override BOOLEAN NOT NULL DEFAULT false,
  relay1_alarm_type TEXT CHECK (relay1_alarm_type IN ('continuous', 'intermittent')),
  relay1_interval_sec INT CHECK (relay1_interval_sec >= 1),
  relay1_trigger_mode TEXT CHECK (relay1_trigger_mode IN ('auto', 'manual')),
  relay1_delay_sec INT CHECK (relay1_delay_sec >= 0),
  relay2_enabled BOOLEAN NOT NULL DEFAULT false,
  relay2_override BOOLEAN NOT NULL DEFAULT false,
  battery_saver_enabled BOOLEAN NOT NULL DEFAULT false,
  battery_saver_threshold INT CHECK (battery_saver_threshold BETWEEN 0 AND 100),
  gyroscope_enabled BOOLEAN NOT NULL DEFAULT false,
  gps_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_alerts_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. NFC TAGS
CREATE TABLE nfc_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_uid TEXT NOT NULL UNIQUE,
  device_id UUID UNIQUE REFERENCES devices(id) ON DELETE SET NULL,
  paired_at TIMESTAMPTZ
);

-- 6. TELEMETRY (GPS)
CREATE TABLE gps_history (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  lat DECIMAL(9,6) NOT NULL,
  lng DECIMAL(9,6) NOT NULL,
  accuracy DECIMAL(6,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gps_device_time ON gps_history (device_id, recorded_at DESC);

-- 6. TELEMETRY (GYRO)
CREATE TABLE gyro_history (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  x DECIMAL(8,4),
  y DECIMAL(8,4),
  z DECIMAL(8,4),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gyro_device_time ON gyro_history (device_id, recorded_at DESC);

-- 6. TELEMETRY (BATTERY)
CREATE TABLE battery_history (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  level INT CHECK (level BETWEEN 0 AND 100),
  charging BOOLEAN,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_battery_device_time ON battery_history (device_id, recorded_at DESC);

-- 6. TELEMETRY (RFID SCANS)
CREATE TABLE rfid_history (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  tag_uid TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rfid_device_time ON rfid_history (device_id, recorded_at DESC);

-- 7. DETECTIONS
CREATE TABLE detections (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity INT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_detection_device_time ON detections (device_id, created_at DESC);

-- 8. ALERTS
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alert_user_time ON alerts (user_id, created_at DESC);

-- 9. AUDIT LOGS
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'device', 'system')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_devices_modtime BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_device_config_modtime BEFORE UPDATE ON device_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

