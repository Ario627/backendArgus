import type { OperationalStatus, HardwareStatus } from './constant/operational-status.constant';
import type { DestinationType } from './constant/destination.constant';

export type UserRole = 'admin' | 'supervisor' | 'driver';

export interface AuthenticatedUser {
  readonly id: string;
  readonly username: string;
  readonly role: UserRole;
  readonly fleetId: string | null;
}

export interface JwtPayload {
  readonly sub: string;
  readonly username: string;
  readonly role: UserRole;
  readonly fleetId: string | null;
}

export interface TelemetryPayload {
  readonly fleetId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly speedKmh: number;
  readonly volumePercent: number;
  readonly hardwareStatus: HardwareStatus;
  readonly deviceTimestamp: string;
}
