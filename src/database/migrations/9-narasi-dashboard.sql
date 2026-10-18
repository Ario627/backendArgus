CREATE TABLE narasi_dashboard (
  id UUID PRIMARY KEY,
  cache_key TEXT NOT NULL CHECK (cache_key ~ '^[0-9a-f]{64}$'),
  sppg_id UUID REFERENCES sppg(id),
  tanggal DATE NOT NULL,
  model TEXT NOT NULL,
  narasi TEXT NOT NULL CHECK (char_length(narasi) BETWEEN 1 AND 2000),
  prompt_tokens INT CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens INT CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (cache_key)
);

CREATE INDEX narasi_dashboard_fresh ON narasi_dashboard (expires_at DESC);
CREATE INDEX narasi_dashboard_sppg ON narasi_dashboard (sppg_id, tanggal DESC);