-- Initialize TimescaleDB Extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable TimescaleDB telemetry (optional)
SELECT telemetry_off();
