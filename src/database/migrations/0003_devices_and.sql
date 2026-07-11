BEGIN;

CREATE TYPE device_status AS ENUM ('unassigned', 'assigned', 'revoked');
CREATE TYPE token_status AS ENUM ('active', 'expired', 'revoked');

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(64) NOT NULL UNIQUE,
  secret VARCHAR(128),
  fleet_id UUID,
  status device_status NOT NULL DEFAULT 'unassigned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_device_id
  ON devices (device_id);

CREATE INDEX IF NOT EXISTS idx_devices_fleet_id
  ON devices (fleet_id);

CREATE INDEX IF NOT EXISTS idx_devices_status
  ON devices (status);

CREATE TABLE IF NOT EXISTS provisioning_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(128) NOT NULL UNIQUE,
  device_id VARCHAR(64),
  fleet_id UUID,
  status token_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provisioning_tokens_token
  ON provisioning_tokens (token);

CREATE INDEX IF NOT EXISTS idx_provisioning_tokens_device_id
  ON provisioning_tokens (device_id);

CREATE INDEX IF NOT EXISTS idx_provisioning_tokens_status
  ON provisioning_tokens (status);

COMMIT;