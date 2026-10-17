CREATE TABLE sppg (
  id UUID PRIMARY KEY,
  public_slug TEXT NOT NULL UNIQUE CHECK (public_slug ~ '^[a-z2-7]{12}$'),
  nama TEXT NOT NULL,
  alamat TEXT,
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  porsi_per_hari INT NOT NULL CHECK (porsi_per_hari > 0),
  mitra TEXT,
  kapasitas_olah_kg NUMERIC(10,2) CHECK (kapasitas_olah_kg IS NULL OR kapasitas_olah_kg > 0),
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE titik_distribusi (
  id UUID PRIMARY KEY,
  sppg_id UUID NOT NULL REFERENCES sppg(id),
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('sekolah','paud','posyandu','puskesmas','lainnya')),
  lat DOUBLE PRECISION CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX titik_distribusi_sppg ON titik_distribusi (sppg_id);

CREATE TABLE fasilitas (
  id UUID PRIMARY KEY,
  nama TEXT NOT NULL,
  tingkat TEXT NOT NULL CHECK (tingkat IN ('T1','T2','T3','T4')),
  jenis TEXT NOT NULL CHECK (jenis IN ('komposter','bsf','hub','tps3r','tpa','lainnya')),
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  kapasitas_kg_hari NUMERIC(10,2) CHECK (kapasitas_kg_hari IS NULL OR kapasitas_kg_hari > 0),
  jam_operasi TEXT,
  mitra BOOLEAN NOT NULL DEFAULT FALSE,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "user" (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9._-]{3,32}$'),
  password_hash TEXT NOT NULL,
  nama TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','sppg_staff','driver','facility','dlh_auditor')),
  sppg_id UUID REFERENCES sppg(id),
  fasilitas_id UUID REFERENCES fasilitas(id),
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((role = 'sppg_staff') = (sppg_id IS NOT NULL)),
  CHECK ((role = 'facility') = (fasilitas_id IS NOT NULL))
);

CREATE TABLE profil_penerimaan (
  id UUID PRIMARY KEY,
  fasilitas_id UUID NOT NULL REFERENCES fasilitas(id),
  versi INT NOT NULL CHECK (versi > 0),
  aturan JSONB NOT NULL,
  berlaku_dari TIMESTAMPTZ NOT NULL,
  berlaku_sampai TIMESTAMPTZ,
  dibuat_oleh UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fasilitas_id, versi),
  CHECK (berlaku_sampai IS NULL OR berlaku_sampai >= berlaku_dari)
);
CREATE UNIQUE INDEX profil_aktif_unik ON profil_penerimaan (fasilitas_id) WHERE berlaku_sampai IS NULL;

CREATE TABLE batch (
  id UUID PRIMARY KEY,
  sppg_id UUID NOT NULL REFERENCES sppg(id),
  aliran TEXT NOT NULL CHECK (aliran IN ('organik','minyak')),
  dikeluarkan_at TIMESTAMPTZ NOT NULL,
  berat_kg NUMERIC(10,2) NOT NULL CHECK (berat_kg > 0 AND berat_kg <= 500),
  kadar_air_proksi TEXT CHECK (kadar_air_proksi IN ('kering','sedang','basah')),
  ada_minyak_terlihat BOOLEAN NOT NULL DEFAULT FALSE,
  tingkat_putusan TEXT CHECK (tingkat_putusan IN ('T0','T1','T2','T3','T4')),
  alasan_putusan JSONB,
  gate_status TEXT CHECK (gate_status IN ('LOLOS','PERBAIKI','ALIHKAN','TOLAK')),
  gate_detail JSONB,
  status TEXT NOT NULL DEFAULT 'DICATAT'
    CHECK (status IN ('DICATAT','MENUNGGU_ANGKUT','DIANGKUT','DITERIMA','DIOLAH','SELESAI','GAGAL_GATE','TERSANGKUT')),
  foto_hash TEXT CHECK (foto_hash IS NULL OR foto_hash ~ '^[0-9a-f]{64}$'),
  client_event_id UUID UNIQUE,
  clock_skew_ms INT CHECK (clock_skew_ms IS NULL OR clock_skew_ms BETWEEN -300000 AND 300000),
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (aliran <> 'minyak' OR berat_kg <= 200)
);
CREATE INDEX batch_sppg_waktu ON batch (sppg_id, dikeluarkan_at DESC);
CREATE INDEX batch_antrean ON batch (status, tingkat_putusan);

CREATE TABLE batch_fraksi (
  batch_id UUID NOT NULL REFERENCES batch(id),
  kode CHAR(1) NOT NULL CHECK (kode IN ('A','B','C','D','E')),
  persen NUMERIC(5,2) NOT NULL CHECK (persen >= 0 AND persen <= 100),
  PRIMARY KEY (batch_id, kode)
);

CREATE TABLE ledger_event (
  id BIGSERIAL PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES batch(id),
  tipe TEXT NOT NULL CHECK (tipe IN ('DIKELUARKAN','DITIMBANG','SERAH_TERIMA','DITERIMA','DIOLAH','KELUARAN','KOREKSI')),
  aktor UUID REFERENCES "user"(id),
  device_id UUID,
  berat_kg NUMERIC(10,2) CHECK (berat_kg IS NULL OR berat_kg >= 0),
  lat DOUBLE PRECISION CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  foto_hash TEXT CHECK (foto_hash IS NULL OR foto_hash ~ '^[0-9a-f]{64}$'),
  waktu_kejadian TIMESTAMPTZ NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL,
  prev_hash TEXT CHECK (prev_hash IS NULL OR prev_hash ~ '^[0-9a-f]{64}$'),
  hash TEXT NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),
  client_event_id UUID UNIQUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (tipe <> 'DIKELUARKAN' OR berat_kg IS NOT NULL)
);
CREATE INDEX ledger_batch ON ledger_event (batch_id, id);
CREATE INDEX ledger_ts ON ledger_event (ts DESC);

CREATE OR REPLACE FUNCTION tolak_ubah_ledger() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_event bersifat tambah-saja';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_no_update
BEFORE UPDATE OR DELETE ON ledger_event
FOR EACH ROW EXECUTE FUNCTION tolak_ubah_ledger();

CREATE TRIGGER ledger_no_truncate
BEFORE TRUNCATE ON ledger_event
FOR EACH STATEMENT EXECUTE FUNCTION tolak_ubah_ledger();

CREATE TABLE anomali (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES batch(id),
  jenis TEXT NOT NULL CHECK (jenis IN ('NERACA_MASSA','DURASI_UMUR','DIGIT_TIDAK_WAJAR','RANTAI_TIMPA','JEDA_PENGAMBILAN')),
  tingkat TEXT NOT NULL CHECK (tingkat IN ('INFO','PERHATIAN','KRITIS')),
  detail JSONB NOT NULL,
  dibuka_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ditutup_at TIMESTAMPTZ,
  ditutup_oleh UUID REFERENCES "user"(id),
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (ditutup_at IS NULL OR ditutup_oleh IS NOT NULL)
);
CREATE INDEX anomali_terbuka ON anomali (dibuka_at DESC) WHERE ditutup_at IS NULL;
CREATE INDEX anomali_batch ON anomali (batch_id);

CREATE TABLE menu_item (
  id UUID PRIMARY KEY,
  nama TEXT NOT NULL,
  komponen TEXT NOT NULL CHECK (komponen IN ('karbohidrat','protein','sayur','buah','susu','lainnya')),
  biaya_rp NUMERIC(14,2) CHECK (biaya_rp IS NULL OR biaya_rp >= 0),
  aktif BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE menu_harian (
  id UUID PRIMARY KEY,
  tanggal DATE NOT NULL,
  sppg_id UUID NOT NULL REFERENCES sppg(id),
  menu_item_id UUID NOT NULL REFERENCES menu_item(id),
  titik_id UUID REFERENCES titik_distribusi(id),
  UNIQUE NULLS NOT DISTINCT (tanggal, sppg_id, menu_item_id, titik_id)
);

CREATE TABLE observasi_sisa (
  id UUID PRIMARY KEY,
  tanggal DATE NOT NULL,
  sppg_id UUID NOT NULL REFERENCES sppg(id),
  titik_id UUID NOT NULL REFERENCES titik_distribusi(id),
  menu_item_id UUID NOT NULL REFERENCES menu_item(id),
  tingkat_sisa SMALLINT NOT NULL CHECK (tingkat_sisa BETWEEN 0 AND 4),
  jumlah_porsi_dinilai INT NOT NULL CHECK (jumlah_porsi_dinilai > 0),
  dinilai_oleh UUID REFERENCES "user"(id),
  client_event_id UUID UNIQUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX observasi_agregat ON observasi_sisa (sppg_id, tanggal, menu_item_id);

CREATE TABLE tiket_warga (
  id UUID PRIMARY KEY,
  sppg_id UUID NOT NULL REFERENCES sppg(id),
  jenis TEXT NOT NULL CHECK (jenis IN ('bau','limbah_cair','tumpukan','lainnya')),
  deskripsi TEXT NOT NULL CHECK (char_length(deskripsi) <= 800),
  foto_hash TEXT CHECK (foto_hash IS NULL OR foto_hash ~ '^[0-9a-f]{64}$'),
  lat DOUBLE PRECISION CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  status TEXT NOT NULL DEFAULT 'BARU' CHECK (status IN ('BARU','DIVERIFIKASI','DITANGGAPI','SELESAI','DITOLAK_MODERASI')),
  jawaban_sppg TEXT,
  jawaban_at TIMESTAMPTZ,
  skor_risiko SMALLINT CHECK (skor_risiko IS NULL OR skor_risiko BETWEEN 0 AND 100),
  ip_hash TEXT NOT NULL CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  client_event_id UUID UNIQUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tiket_kotak_masuk ON tiket_warga (sppg_id, status, created_at DESC);
CREATE INDEX tiket_rate ON tiket_warga (ip_hash, created_at);

CREATE TABLE tiket_event (
  id UUID PRIMARY KEY,
  tiket_id UUID NOT NULL REFERENCES tiket_warga(id),
  dari_status TEXT,
  ke_status TEXT NOT NULL,
  aktor UUID REFERENCES "user"(id),
  catatan TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tiket_event_tiket ON tiket_event (tiket_id, ts);

CREATE TABLE foto (
  sha256 TEXT PRIMARY KEY CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime TEXT NOT NULL CHECK (mime IN ('image/webp','image/jpeg')),
  bytes INT NOT NULL CHECK (bytes > 0 AND bytes <= 1048576),
  lebar INT,
  tinggi INT,
  diunggah_oleh UUID REFERENCES "user"(id),
  ref_tipe TEXT NOT NULL CHECK (ref_tipe IN ('batch','ledger_event','tiket','lainnya')),
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE parameter_kalibrasi (
  kunci TEXT PRIMARY KEY,
  nilai NUMERIC,
  satuan TEXT,
  sumber TEXT NOT NULL CHECK (sumber IN ('literatur','kalibrasi_pilot','manual_admin','belum_ada')),
  catatan TEXT,
  updated_by UUID REFERENCES "user"(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((nilai IS NULL) = (sumber = 'belum_ada')),
  CHECK (sumber <> 'manual_admin' OR catatan IS NOT NULL)
);