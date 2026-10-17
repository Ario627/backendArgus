ALTER TABLE route_plan ADD COLUMN sppg_id UUID REFERENCES sppg(id);
ALTER TABLE route_plan ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('optimizer', 'greedy', 'manual'));
ALTER TABLE route_plan ADD COLUMN matrix_source TEXT NOT NULL DEFAULT 'haversine'
  CHECK (matrix_source IN ('mapbox', 'haversine'));
ALTER TABLE route_plan ADD COLUMN ringkasan JSONB;

CREATE UNIQUE INDEX route_plan_aktif_unik ON route_plan (sppg_id, tanggal)
  WHERE status = 'AKTIF' AND sppg_id IS NOT NULL;
CREATE UNIQUE INDEX route_plan_judul_unik ON route_plan (sppg_id, tanggal)
  WHERE status = 'NEEDS_MANUAL_SCHEDULING';