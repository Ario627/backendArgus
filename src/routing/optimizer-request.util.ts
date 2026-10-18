import type { GeoCoordinate } from '../common/utils/geo.util.js';
import type {
  OptimizerPreviousRoute,
  OptimizerRequest,
  OptimizerStop,
  OptimizerVehicle,
} from './optimizer.contract.js';

export interface OptimizerRequestInput {
  readonly date: string;
  readonly depotId: string;
  readonly readyAtIso: string;
  readonly timeLimitSeconds: number;
  readonly travelCostPerSecond: number | null;
  readonly latePenaltyPerKgMinute: number | null;
  readonly maxRouteSeconds: number | null;
  readonly previousRoutes: readonly OptimizerPreviousRoute[] | null;
  readonly vehicles: readonly OptimizerVehicle[];
  readonly stops: readonly OptimizerStop[];
  readonly matrixSeconds: readonly (readonly number[])[];
}

const MIN_ROUTE_SECONDS = 60;
const MAX_ROUTE_SECONDS = 172800;

const buildOptions = (
  input: OptimizerRequestInput,
): OptimizerRequest['options'] => {
  const travel = input.travelCostPerSecond;
  const late = input.latePenaltyPerKgMinute;
  const cap = input.maxRouteSeconds;
  const previous = input.previousRoutes;
  return Object.freeze({
    timeLimitSeconds: input.timeLimitSeconds,
    ...(travel !== null && Number.isFinite(travel) && travel > 0
      ? {
          travelCostPerSecond: travel,
          latePenaltyPerKgMinute:
            late === null || !Number.isFinite(late) || late < 0 ? 0 : late,
        }
      : {}),
    ...(cap !== null &&
    Number.isFinite(cap) &&
    cap >= MIN_ROUTE_SECONDS &&
    cap <= MAX_ROUTE_SECONDS
      ? { maxRouteSeconds: Math.round(cap) }
      : {}),
    ...(previous !== null && previous.length > 0
      ? { previousRoutes: previous }
      : {}),
  });
};

export const buildOptimizerRequest = (
  input: OptimizerRequestInput,
): OptimizerRequest => ({
  date: input.date,
  depotId: input.depotId,
  finalStopId: '',
  vehicles: Object.freeze([...input.vehicles]),
  stops: Object.freeze([...input.stops]),
  matrixSeconds: Object.freeze(
    input.matrixSeconds.map((row) => Object.freeze([...row])),
  ),
  options: buildOptions(input),
});

export const coordinateOf = (
  lat: number | null,
  lng: number | null,
): GeoCoordinate | null => (lat === null || lng === null ? null : { lat, lng });
