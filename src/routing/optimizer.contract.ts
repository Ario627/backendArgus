export const OPTIMIZER_STATUSES = Object.freeze([
  'OK',
  'FEASIBLE',
  'PARTIAL',
  'NO_SOLUTION',
] as const);
export type OptimizerStatus = (typeof OPTIMIZER_STATUSES)[number];

export interface OptimizerVehicle {
  readonly fleetId: string;
  readonly capacityKg: number;
  readonly startLat: number;
  readonly startLng: number;
  readonly startTime: string;
}

export interface OptimizerStop {
  readonly batchId: string;
  readonly lat: number;
  readonly lng: number;
  readonly kg: number;
  readonly readyAt: string;
  readonly deadline: string | null;
  readonly targetFacilityId: string;
}

export const OPTIMIZER_UNASSIGNED_REASONS = Object.freeze([
  'KAPASITAS',
  'BATAS_WAKTU',
  'TIDAK_TERJADWAL',
  'OPTIMIZER',
] as const);
export type OptimizerUnassignedReason =
  (typeof OPTIMIZER_UNASSIGNED_REASONS)[number];

export interface OptimizerUnassigned {
  readonly batchId: string;
  readonly reason: OptimizerUnassignedReason;
}

export const OPTIMIZER_STRATEGIES = Object.freeze([
  'descent',
  'gls',
  'warm',
] as const);
export type OptimizerStrategy = (typeof OPTIMIZER_STRATEGIES)[number];

export interface OptimizerPreviousRoute {
  readonly fleetId: string;
  readonly sequence: readonly string[];
}

export interface OptimizerOptions {
  readonly timeLimitSeconds: number;
  readonly travelCostPerSecond?: number;
  readonly latePenaltyPerKgMinute?: number;
  readonly maxRouteSeconds?: number;
  readonly previousRoutes?: readonly OptimizerPreviousRoute[];
}

export interface OptimizerRequest {
  readonly date: string;
  readonly depotId: string;
  readonly finalStopId: string;
  readonly vehicles: readonly OptimizerVehicle[];
  readonly stops: readonly OptimizerStop[];
  readonly matrixSeconds: readonly (readonly number[])[];
  readonly options: OptimizerOptions;
}

export interface OptimizerRoute {
  readonly fleetId: string;
  readonly sequence: readonly string[];
  readonly totalKg: number;
  readonly estimatedSeconds: number;
  readonly lateRiskKg: number;
}

export interface OptimizerSolverStats {
  readonly objective: number;
  readonly timeSeconds: number;
  readonly strategy?: OptimizerStrategy;
}

export interface OptimizerResponse {
  readonly status: OptimizerStatus;
  readonly planId: string | null;
  readonly routes: readonly OptimizerRoute[];
  readonly unassigned: readonly OptimizerUnassigned[];
  readonly solverStats: OptimizerSolverStats;
}
