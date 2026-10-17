export interface GreedyStopInput {
  readonly batchId: string;
  readonly kg: number;
  readonly deadlineMs: number | null;
  readonly nodeIndex: number;
}

export interface GreedyVehicleInput {
  readonly fleetId: string;
  readonly capacityKg: number;
}

export interface GreedyInput {
  readonly stops: readonly GreedyStopInput[];
  readonly vehicles: readonly GreedyVehicleInput[];
  readonly durationsSeconds: readonly (readonly number[])[];
  readonly serviceSecondsPerStop: number;
  readonly startEpochMs: number;
}

export interface GreedyAssignment {
  readonly fleetId: string;
  readonly sequence: readonly string[];
  readonly totalKg: number;
  readonly estimatedSeconds: number;
  readonly lateRiskKg: number;
}

export interface GreedyUnassigned {
  readonly batchId: string;
  readonly reason: string;
}

export interface GreedyOutcome {
  readonly assignments: readonly GreedyAssignment[];
  readonly unassigned: readonly GreedyUnassigned[];
}

interface VehicleState {
  readonly fleetId: string;
  readonly capacityKg: number;
  loadKg: number;
  elapsedSeconds: number;
  lastNodeIndex: number;
  sequence: string[];
  lateRiskKg: number;
}

const DEPOT_NODE_INDEX = 0;

const travelSeconds = (
  durations: readonly (readonly number[])[],
  fromIndex: number,
  toIndex: number,
): number => durations[fromIndex]?.[toIndex] ?? 0;

const buildStopComparator =
  (durations: readonly (readonly number[])[]) =>
  (left: GreedyStopInput, right: GreedyStopInput): number => {
    const leftDeadline = left.deadlineMs ?? Number.POSITIVE_INFINITY;
    const rightDeadline = right.deadlineMs ?? Number.POSITIVE_INFINITY;
    if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline;
    const leftFromDepot = travelSeconds(
      durations,
      DEPOT_NODE_INDEX,
      left.nodeIndex,
    );
    const rightFromDepot = travelSeconds(
      durations,
      DEPOT_NODE_INDEX,
      right.nodeIndex,
    );
    if (leftFromDepot !== rightFromDepot) return leftFromDepot - rightFromDepot;
    if (left.kg !== right.kg) return right.kg - left.kg;
    return left.batchId < right.batchId ? -1 : 1;
  };

const pickVehicle = (
  states: readonly VehicleState[],
  stop: GreedyStopInput,
  durations: readonly (readonly number[])[],
): VehicleState | null => {
  let best: VehicleState | null = null;
  let bestTravel = Number.POSITIVE_INFINITY;
  for (const state of states) {
    if (state.loadKg + stop.kg > state.capacityKg) continue;
    const travel = travelSeconds(
      durations,
      state.lastNodeIndex,
      stop.nodeIndex,
    );
    if (
      travel < bestTravel ||
      (travel === bestTravel &&
        best !== null &&
        (state.elapsedSeconds < best.elapsedSeconds ||
          (state.elapsedSeconds === best.elapsedSeconds &&
            state.fleetId < best.fleetId)))
    ) {
      best = state;
      bestTravel = travel;
    }
  }
  return best;
};

export const planGreedy = (input: GreedyInput): GreedyOutcome => {
  const states: VehicleState[] = input.vehicles.map((vehicle) => ({
    fleetId: vehicle.fleetId,
    capacityKg: vehicle.capacityKg,
    loadKg: 0,
    elapsedSeconds: 0,
    lastNodeIndex: DEPOT_NODE_INDEX,
    sequence: [],
    lateRiskKg: 0,
  }));

  const ordered = [...input.stops].sort(
    buildStopComparator(input.durationsSeconds),
  );
  const unassigned: GreedyUnassigned[] = [];

  for (const stop of ordered) {
    const vehicle = pickVehicle(states, stop, input.durationsSeconds);
    if (vehicle === null) {
      unassigned.push(
        Object.freeze({ batchId: stop.batchId, reason: 'KAPASITAS' }),
      );
      continue;
    }
    const travel = travelSeconds(
      input.durationsSeconds,
      vehicle.lastNodeIndex,
      stop.nodeIndex,
    );
    const arrivalMs =
      input.startEpochMs + (vehicle.elapsedSeconds + travel) * 1000;
    if (stop.deadlineMs !== null && arrivalMs > stop.deadlineMs) {
      vehicle.lateRiskKg += stop.kg;
    }
    vehicle.elapsedSeconds += travel + input.serviceSecondsPerStop;
    vehicle.loadKg += stop.kg;
    vehicle.lastNodeIndex = stop.nodeIndex;
    vehicle.sequence.push(stop.batchId);
  }

  const assignments: GreedyAssignment[] = [];
  for (const state of states) {
    if (state.sequence.length === 0) continue;
    assignments.push(
      Object.freeze({
        fleetId: state.fleetId,
        sequence: Object.freeze([...state.sequence]),
        totalKg: state.loadKg,
        estimatedSeconds: Math.round(state.elapsedSeconds),
        lateRiskKg: state.lateRiskKg,
      }),
    );
  }

  return Object.freeze({
    assignments: Object.freeze(assignments),
    unassigned: Object.freeze(unassigned),
  });
};