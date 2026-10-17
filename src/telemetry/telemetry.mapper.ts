import type { HardwareStatus } from '../common/constant/domain.constant.js';
import type { TelemetryRow } from '../database/entities/telemetry-row.entity.js';

export interface TelemetryPointDto {
  readonly fleetId: string;
  readonly deviceTimestamp: string;
  readonly receivedAt: string;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly speedKmh: number | null;
  readonly volumePercent: number | null;
  readonly hardwareStatus: HardwareStatus | null;
}

export const toTelemetryPointDto = (row: TelemetryRow): TelemetryPointDto => ({
  fleetId: row.fleetId,
  deviceTimestamp: row.deviceTimestamp.toISOString(),
  receivedAt: row.receivedAt.toISOString(),
  lat: row.lat,
  lng: row.lng,
  speedKmh: row.speedKmh,
  volumePercent: row.volumePercent,
  hardwareStatus: row.hardwareStatus,
});