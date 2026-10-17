export interface RouteUnassignedEntry {
  readonly batchId: string;
  readonly reason: string;
}

export interface RouteVehicleSummary {
  readonly fleetId: string;
  readonly capacityKg: number;
}

export interface RouteSolverStats {
  readonly objective: number;
  readonly timeSeconds: number;
}

export interface RoutePlanSummary {
  readonly window: { readonly start: string; readonly end: string };
  readonly speedSource: string;
  readonly unassigned: readonly RouteUnassignedEntry[];
  readonly tanpaFasilitas: readonly string[];
  readonly skippedVehicles: readonly string[];
  readonly vehicles: readonly RouteVehicleSummary[];
  readonly solverStats: RouteSolverStats | null;
  readonly reason: string | null;
}