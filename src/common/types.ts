import type {
  OperationalStatus,
  HardwareStatus,
} from './constant/operational-status.constant';
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

export interface GeoPoint {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
}

export interface BrokenStop {
  readonly destId: string;
  readonly demandKg: number;
  readonly priority: number;
}

export interface GreedyAssignment {
  readonly receiverFleetId: string;
  readonly stops: BrokenStop[];
}

export interface VehicleInput {
  readonly id: string;
  readonly startLat: number;
  readonly startLng: number;
  readonly capacityKg: number;
}

export interface DestinationInput {
  readonly id: string;
  readonly type: DestinationType;
  readonly lat: number;
  readonly lng: number;
  readonly demandKg: number;
  readonly priority: number;
  readonly serviceMinutes: number;
  readonly historicalVolumeAvg: number;
  readonly lowVolumeFlag: boolean;
}

export interface DistanceMatrixRow {
  readonly from: string;
  readonly to: string;
  readonly meters: number;
  readonly seconds: number;
}

export interface DistanceMatrix {
  readonly mode: 'mapbox' | 'haversine_fallback';
  readonly rows: DistanceMatrixRow[];
}

export interface OptimizationConstraints {
  readonly maxRouteMinutes: number;
  readonly finalDepotId: string;
  readonly skipLowVolume: boolean;
  readonly lowVolumeThreshold: number;
}

export interface OptimizationInput {
  readonly mode: 'daily_plan' | 'swarm_recovery';
  readonly vehicles: VehicleInput[];
  readonly destinations: DestinationInput[];
  readonly distanceMatrix: DistanceMatrix;
  readonly constraints: OptimizationConstraints;
}

export interface RouteStop {
  readonly destId: string;
  readonly order: number;
  readonly etaEpoch: number;
  readonly cumulativeKm: number;
}

export interface RouteResult {
  readonly vehicleId: string;
  readonly stops: RouteStop[];
  readonly totalKm: number;
  readonly totalMinutes: number;
}

export interface SkippedDestination {
  readonly destId: string;
  readonly reason: string;
}

export interface OptimizationOutput {
  readonly status: 'OK' | 'NO_SOLUTION' | 'FEASIBLE';
  readonly routes: RouteResult[];
  readonly skipped: SkippedDestination[];
  readonly solverDurationMs: number;
}

export interface RecoveryResult {
  readonly brokenFleetId: string;
  readonly receivingFleetIds: string[];
  readonly redistributedStopIds: string[];
  readonly durationMs: number;
  readonly fallback: boolean;
  readonly status: 'success' | 'no_receiver' | 'fallback_greedy';
  readonly llmNarrative: string | null;
}

export interface FleetPosition {
  readonly fleetId: string;
  readonly plateNumber: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly operationalStatus: OperationalStatus;
  readonly lastDeviceTimestamp: Date | null;
  readonly stalenessSeconds: number;
  readonly isRealTime: boolean;
  readonly volumePercent: number | null;
  readonly hardwareStatus: HardwareStatus;
}

export interface DashboardSummary {
  readonly totalFleet: number;
  readonly onlineNormal: number;
  readonly onlineBroken: number;
  readonly stale: number;
  readonly offline: number;
  readonly recoveryCountToday: number;
  readonly avgRouteEfficiency: number;
  readonly llmSummary: string | null;
  readonly generatedAt: Date;
}

export interface PaginatedResponse<T> {
  readonly data: T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly hasNext: boolean;
}
