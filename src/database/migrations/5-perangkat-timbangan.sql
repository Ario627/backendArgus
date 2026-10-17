ALTER TABLE device RENAME COLUMN secret_hash TO secret_enc;

ALTER TABLE device DROP CONSTRAINT device_check;

ALTER TABLE device ADD CONSTRAINT device_secret_check
  CHECK (tipe <> 'timbangan' OR secret_enc IS NOT NULL);

ALTER TABLE device ADD COLUMN sppg_id UUID REFERENCES sppg(id);
ALTER TABLE device ADD COLUMN last_weight_at TIMESTAMPTZ;

ALTER TABLE device ADD CONSTRAINT device_target_check
  CHECK ((tipe = 'timbangan') = (sppg_id IS NOT NULL));

CREATE INDEX device_sppg ON device (sppg_id) WHERE sppg_id IS NOT NULL;

CREATE TABLE penimbangan_menunggu (
  id UUID PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES device(id),
  sppg_id UUID NOT NULL REFERENCES sppg(id),
  berat_kg NUMERIC(10,2) NOT NULL CHECK (berat_kg >= 0 AND berat_kg <= 500),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dipakai_batch_id UUID REFERENCES batch(id),
  ditautkan_at TIMESTAMPTZ,
  ditautkan_oleh UUID REFERENCES "user"(id),
  diarsipkan_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (dipakai_batch_id IS NULL OR ditautkan_at IS NOT NULL),
  CHECK (ditautkan_oleh IS NULL OR ditautkan_at IS NOT NULL)
);

CREATE UNIQUE INDEX penimbangan_menunggu_unik ON penimbangan_menunggu (device_id, occurred_at);
CREATE INDEX penimbangan_menunggu_antre ON penimbangan_menunggu (sppg_id, received_at DESC)
  WHERE ditautkan_at IS NULL AND diarsipkan_at IS NULL;