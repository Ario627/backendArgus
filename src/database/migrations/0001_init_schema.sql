BEGIN;

CREATE TYPE hardware_status AS ENUM ('normal', 'broken');
CREATE TYPE operational_status AS ENUM ('ONLINE_NORMAL', 'ONLINE_BROKEN', 'STALE', 'OFFLINE');
CREATE TYPE destination_type AS ENUM ('TPA', 'RDF', 'TPS_3R');
CREATE TYPE route_plan_status AS ENUM ('active', 'done', 'cancelled');
CREATE TYPE recovery_status AS ENUM ('success', 'no_receiver', 'fallback_greedy');
CREATE TYPE user_role AS ENUM ('admin', 'supervisor', 'driver');

CREATE TABLE IF NOT EXISTS fleet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number VARCHAR(12) NOT NULL UNIQUE,
  driver_name VARCHAR NOT NULL,
  driver_contact VARCHAR,
  capacity_kg INTEGER NOT NULL,
  status_hardware hardware_status NOT NULL DEFAULT 'normal',
  operational_status operational_status NOT NULL DEFAULT 'OFFLINE',
  last_device_timestamp TIMESTAMPTZ,
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_volume_percent SMALLINT,
  last_hardware_status hardware_status,
  device_revoked_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_operational_status
  ON fleet (operational_status);

CREATE TABLE IF NOT EXISTS destination (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  type destination_type NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  capacity_kg INTEGER NOT NULL DEFAULT 5000,
  priority INTEGER NOT NULL DEFAULT 3,
  low_volume_flag BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_destination_type
  ON destination (type);

CREATE TABLE IF NOT EXISTS route_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id UUID NOT NULL REFERENCES fleet(id) ON DELETE RESTRICT,
  plan_date DATE NOT NULL,
  stops JSONB NOT NULL DEFAULT '[]',
  total_km NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  status route_plan_status NOT NULL DEFAULT 'active',
  low_confidence BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_plan_fleet_date
  ON route_plan (fleet_id, plan_date);

CREATE TABLE IF NOT EXISTS recovery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broken_fleet_id UUID NOT NULL REFERENCES fleet(id) ON DELETE RESTRICT,
  receiving_fleet_ids JSONB NOT NULL DEFAULT '[]',
  redistributed_stops JSONB NOT NULL DEFAULT '[]',
  detected_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  fallback BOOLEAN NOT NULL DEFAULT false,
  status recovery_status NOT NULL DEFAULT 'success',
  llm_narrative TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_log_broken_fleet
  ON recovery_log (broken_fleet_id);

CREATE INDEX IF NOT EXISTS idx_recovery_log_detected_at
  ON recovery_log (detected_at);

CREATE TABLE IF NOT EXISTS "user" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  role user_role NOT NULL,
  fleet_id UUID REFERENCES fleet(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telemetry (
  id BIGSERIAL NOT NULL,
  fleet_id UUID NOT NULL REFERENCES fleet(id) ON DELETE RESTRICT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed_kmh DOUBLE PRECISION NOT NULL,
  volume_percent SMALLINT NOT NULL,
  hardware_status hardware_status NOT NULL,
  device_timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, device_timestamp)
);

SELECT create_hypertable(
  'telemetry',
  'device_timestamp',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => true
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_fleet_device_ts
  ON telemetry (fleet_id, device_timestamp);

CREATE INDEX IF NOT EXISTS idx_telemetry_fleet_device_ts_desc
  ON telemetry (fleet_id, device_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_device_ts_desc
  ON telemetry (device_timestamp DESC);

COMMIT;
