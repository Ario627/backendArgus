import type { GeoCoordinate } from '../common/utils/geo.util.js';
import type {
  OptimizerRequest,
  OptimizerStop,
  OptimizerVehicle,
} from './optimizer.contract.js';

export interface OptimizerRequestInput {
  readonly date: string;
  readonly depotId: string;
  readonly readyAtIso: string;
  readonly timeLimitSeconds: number;
  readonly vehicles: readonly OptimizerVehicle[];
  readonly stops: readonly OptimizerStop[];
  readonly matrixSeconds: readonly (readonly number[])[];
}

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
  options: Object.freeze({ timeLimitSeconds: input.timeLimitSeconds }),
});

export const coordinateOf = (
  lat: number | null,
  lng: number | null,
): GeoCoordinate | null =>
  lat === null || lng === null ? null : { lat, lng };