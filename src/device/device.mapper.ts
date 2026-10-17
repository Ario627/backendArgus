import type { DeviceType } from '../common/constant/domain.constant.js';
import type { Device } from '../database/entities/device.entity.js';

export interface DeviceDto {
  readonly id: string;
  readonly tipe: DeviceType;
  readonly fleetId: string | null;
  readonly sppgId: string | null;
  readonly mqttUsername: string;
  readonly firmware: string | null;
  readonly lastSeenAt: string | null;
  readonly lastWeightAt: string | null;
  readonly revokedAt: string | null;
  readonly aktif: boolean;
  readonly createdAt: string;
}

export interface DeviceProvisioningDto {
  readonly mqttUsername: string;
  readonly mqttPassword: string;
  readonly deviceSecret: string | null;
}

export const toDeviceDto = (device: Device): DeviceDto => ({
  id: device.id,
  tipe: device.tipe,
  fleetId: device.fleetId,
  sppgId: device.sppgId,
  mqttUsername: device.mqttUsername,
  firmware: device.firmware,
  lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
  lastWeightAt: device.lastWeightAt?.toISOString() ?? null,
  revokedAt: device.revokedAt?.toISOString() ?? null,
  aktif: device.revokedAt === null,
  createdAt: device.createdAt.toISOString(),
});