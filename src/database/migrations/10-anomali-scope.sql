ALTER TABLE anomali ALTER COLUMN batch_id DROP NOT NULL;

ALTER TABLE anomali ADD COLUMN sppg_id UUID REFERENCES sppg(id);

ALTER TABLE anomali ADD CONSTRAINT anomali_scope_tunggal
  CHECK ((batch_id IS NULL) <> (sppg_id IS NULL));

CREATE INDEX anomali_sppg ON anomali (sppg_id, dibuka_at DESC);

CREATE UNIQUE INDEX anomali_unik_terbuka_sppg ON anomali (sppg_id, jenis)
  WHERE ditutup_at IS NULL;
