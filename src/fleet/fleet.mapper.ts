import type { FleetStatus } from '../common/constant/domain.constant.js';
import type { Fleet } from '../database/entities/fleet.entity.js';

export interface FleetDto {
  readonly id: string;
  readonly kode: string;
  readonly plat: string | null;
  readonly driverNama: string | null;
  readonly driverKontak: string | null;
  readonly kapasitasKg: number | null;
  readonly statusOperasional: FleetStatus;
  readonly lastLat: number | null;
  readonly lastLng: number | null;
  readonly lastDeviceTimestamp: string | null;
  readonly stalenessSeconds: number | null;
  readonly aktif: boolean;
  readonly isDemo: boolean;
}

const stalenessSecondsOf = (
  lastDeviceTimestamp: Date | null,
  nowMs: number,
): number | null =>
  lastDeviceTimestamp === null
    ? null
    : Math.max(0, Math.floor((nowMs - lastDeviceTimestamp.getTime()) / 1000));

export const toFleetDto = (fleet: Fleet, nowMs: number): FleetDto => ({
  id: fleet.id,
  kode: fleet.kode,
  plat: fleet.plat,
  driverNama: fleet.driverNama,
  driverKontak: fleet.driverKontak,
  kapasitasKg: fleet.kapasitasKg,
  statusOperasional: fleet.statusOperasional,
  lastLat: fleet.lastLat,
  lastLng: fleet.lastLng,
  lastDeviceTimestamp: fleet.lastDeviceTimestamp?.toISOString() ?? null,
  stalenessSeconds: stalenessSecondsOf(fleet.lastDeviceTimestamp, nowMs),
  aktif: fleet.aktif,
  isDemo: fleet.isDemo,
});