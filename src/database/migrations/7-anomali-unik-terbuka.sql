CREATE UNIQUE INDEX anomali_unik_terbuka ON anomali (batch_id, jenis)
  WHERE ditutup_at IS NULL;