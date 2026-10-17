CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  aktor UUID REFERENCES "user"(id),
  aktor_peran TEXT CHECK (
    aktor_peran IS NULL
    OR aktor_peran IN ('admin','sppg_staff','driver','facility','dlh_auditor')
  ),
  aksi TEXT NOT NULL CHECK (char_length(aksi) BETWEEN 3 AND 120),
  entitas TEXT CHECK (entitas IS NULL OR char_length(entitas) <= 60),
  entitas_id TEXT CHECK (entitas_id IS NULL OR char_length(entitas_id) <= 120),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT CHECK (
    request_id IS NULL OR char_length(request_id) BETWEEN 8 AND 80
  ),
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_ts ON audit_log (ts DESC, id DESC);
CREATE INDEX audit_log_aktor_ts ON audit_log (aktor, ts DESC);
CREATE INDEX audit_log_aksi_ts ON audit_log (aksi, ts DESC);
CREATE INDEX audit_log_entitas ON audit_log (entitas, entitas_id, ts DESC);

CREATE OR REPLACE FUNCTION tolak_ubah_audit() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log bersifat append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION tolak_ubah_audit();

CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit_log
FOR EACH STATEMENT EXECUTE FUNCTION tolak_ubah_audit();