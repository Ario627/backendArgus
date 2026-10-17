CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE fleet (
  id UUID PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  plat TEXT,
  driver_nama TEXT,
  driver_kontak TEXT,
  kapasitas_kg NUMERIC(10,2) CHECK (kapasitas_kg IS NULL OR kapasitas_kg > 0),
  status_operasional TEXT NOT NULL DEFAULT 'OFFLINE'
    CHECK (status_operasional IN ('ONLINE_NORMAL','ONLINE_BROKEN','STALE','OFFLINE')),
  last_lat DOUBLE PRECISION CHECK (last_lat IS NULL OR last_lat BETWEEN -90 AND 90),
  last_lng DOUBLE PRECISION CHECK (last_lng IS NULL OR last_lng BETWEEN -180 AND 180),
  last_device_timestamp TIMESTAMPTZ,
  device_revoked_at TIMESTAMPTZ,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE device (
  id UUID PRIMARY KEY,
  tipe TEXT NOT NULL CHECK (tipe IN ('tracker','timbangan')),
  fleet_id UUID REFERENCES fleet(id),
  secret_hash TEXT,
  mqtt_username TEXT NOT NULL UNIQUE,
  mqtt_password_hash TEXT NOT NULL,
  firmware TEXT,
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (tipe <> 'timbangan' OR secret_hash IS NOT NULL)
);

ALTER TABLE ledger_event
  ADD CONSTRAINT ledger_event_device_fk FOREIGN KEY (device_id) REFERENCES device(id);

CREATE TABLE telemetry (
  fleet_id UUID NOT NULL,
  device_timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat DOUBLE PRECISION CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  speed_kmh NUMERIC(6,2),
  volume_persen NUMERIC(5,2) CHECK (volume_persen IS NULL OR (volume_persen >= 0 AND volume_persen <= 100)),
  hardware_status TEXT CHECK (hardware_status IN ('normal','broken')),
  PRIMARY KEY (fleet_id, device_timestamp)
);

SELECT create_hypertable('telemetry', by_range('device_timestamp'), if_not_exists => TRUE);
CREATE INDEX telemetry_fleet_waktu ON telemetry (fleet_id, device_timestamp DESC);

ALTER TABLE telemetry SET (
  timescaledb.enable_columnstore = true,
  timescaledb.segmentby = 'fleet_id',
  timescaledb.orderby = 'device_timestamp DESC'
);

CALL add_columnstore_policy('telemetry', after => INTERVAL '30 days', if_not_exists => TRUE);

CREATE TABLE route_plan (
  id UUID PRIMARY KEY,
  tanggal DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','AKTIF','SELESAI','NEEDS_MANUAL_SCHEDULING','BATAL')),
  total_kg NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_kg >= 0),
  total_km NUMERIC(10,2) CHECK (total_km IS NULL OR total_km >= 0),
  final_stop_id UUID,
  dibuat_oleh UUID REFERENCES "user"(id),
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX route_plan_tanggal ON route_plan (tanggal, status);

CREATE TABLE route_stop (
  id UUID PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES route_plan(id),
  batch_id UUID NOT NULL REFERENCES batch(id),
  fleet_id UUID REFERENCES fleet(id),
  urutan INT NOT NULL CHECK (urutan >= 0),
  jenis TEXT NOT NULL CHECK (jenis IN ('AMBIL','ANTAR')),
  fasilitas_id UUID REFERENCES fasilitas(id),
  eta TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'RENCANA'
    CHECK (status IN ('RENCANA','SAMPAI','SELESAI','GAGAL')),
  UNIQUE (plan_id, urutan)
);
CREATE INDEX route_stop_batch ON route_stop (batch_id);