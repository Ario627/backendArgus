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

export interface OptimizerRequest {
  readonly date: string;
  readonly depotId: string;
  readonly finalStopId: string;
  readonly vehicles: readonly OptimizerVehicle[];
  readonly stops: readonly OptimizerStop[];
  readonly matrixSeconds: readonly (readonly number[])[];
  readonly options: { readonly timeLimitSeconds: number };
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
}

export interface OptimizerResponse {
  readonly status: OptimizerStatus;
  readonly planId: string | null;
  readonly routes: readonly OptimizerRoute[];
  readonly unassigned: readonly string[];
  readonly solverStats: OptimizerSolverStats;
}