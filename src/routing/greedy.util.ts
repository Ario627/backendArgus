export interface GreedyStopInput {
  readonly batchId: string;
  readonly kg: number;
  readonly readyMs: number | null;
  readonly deadlineMs: number | null;
  readonly nodeIndex: number;
}

export interface GreedyVehicleInput {
  readonly fleetId: string;
  readonly capacityKg: number;
}

export interface GreedyLock {
  readonly fleetId: string;
  readonly sequence: readonly string[];
}

export interface GreedyInput {
  readonly stops: readonly GreedyStopInput[];
  readonly vehicles: readonly GreedyVehicleInput[];
  readonly durationsSeconds: readonly (readonly number[])[];
  readonly serviceSecondsPerStop: number;
  readonly startEpochMs: number;
  readonly maxSeconds?: number | null;
  readonly locks?: readonly GreedyLock[];
}

export interface GreedyAssignment {
  readonly fleetId: string;
  readonly sequence: readonly string[];
  readonly totalKg: number;
  readonly estimatedSeconds: number;
  readonly lateRiskKg: number;
}

export type GreedyReason = 'KAPASITAS' | 'BATAS_WAKTU' | 'TIDAK_TERJADWAL';

export interface GreedyUnassigned {
  readonly batchId: string;
  readonly reason: GreedyReason;
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
const CAPACITY_EPSILON = 1e-9;

const travelSeconds = (
  durations: readonly (readonly number[])[],
  fromIndex: number,
  toIndex: number,
): number => durations[fromIndex]?.[toIndex] ?? 0;

const exceedsAllCapacities = (
  kg: number,
  vehicles: readonly GreedyVehicleInput[],
): boolean =>
  vehicles.every((vehicle) => kg > vehicle.capacityKg + CAPACITY_EPSILON);

const exceedsDeadline = (
  arrivalMs: number,
  deadlineMs: number | null,
): boolean => deadlineMs !== null && arrivalMs > deadlineMs;

const departureSeconds = (
  arrivalSeconds: number,
  readyMs: number | null,
  serviceSeconds: number,
): number => {
  const floorSeconds = readyMs === null ? arrivalSeconds : readyMs / 1000;
  return Math.max(arrivalSeconds, floorSeconds) + serviceSeconds;
};

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

const fitsCapacity = (state: VehicleState, stop: GreedyStopInput): boolean =>
  state.loadKg + stop.kg <= state.capacityKg + CAPACITY_EPSILON;

const fitsTimeCap = (
  state: VehicleState,
  stop: GreedyStopInput,
  input: GreedyInput,
): boolean => {
  if (input.maxSeconds === null || input.maxSeconds === undefined) return true;
  const travel = travelSeconds(
    input.durationsSeconds,
    state.lastNodeIndex,
    stop.nodeIndex,
  );
  const arrival = state.elapsedSeconds + travel;
  return (
    departureSeconds(arrival, stop.readyMs, input.serviceSecondsPerStop) <=
    input.maxSeconds
  );
};

const canServe = (
  state: VehicleState,
  stop: GreedyStopInput,
  input: GreedyInput,
): boolean => fitsCapacity(state, stop) && fitsTimeCap(state, stop, input);

const applyStop = (
  state: VehicleState,
  stop: GreedyStopInput,
  input: GreedyInput,
): void => {
  const travel = travelSeconds(
    input.durationsSeconds,
    state.lastNodeIndex,
    stop.nodeIndex,
  );
  const arrival = state.elapsedSeconds + travel;
  const arrivalMs = input.startEpochMs + arrival * 1000;
  if (exceedsDeadline(arrivalMs, stop.deadlineMs)) {
    state.lateRiskKg += stop.kg;
  }
  state.elapsedSeconds = departureSeconds(
    arrival,
    stop.readyMs,
    input.serviceSecondsPerStop,
  );
  state.loadKg += stop.kg;
  state.lastNodeIndex = stop.nodeIndex;
  state.sequence.push(stop.batchId);
};

const createStates = (input: GreedyInput): VehicleState[] =>
  input.vehicles.map((vehicle) => ({
    fleetId: vehicle.fleetId,
    capacityKg: vehicle.capacityKg,
    loadKg: 0,
    elapsedSeconds: 0,
    lastNodeIndex: DEPOT_NODE_INDEX,
    sequence: [],
    lateRiskKg: 0,
  }));

const seedLocks = (
  input: GreedyInput,
  states: readonly VehicleState[],
  stopByBatch: ReadonlyMap<string, GreedyStopInput>,
  placed: Set<string>,
): void => {
  const stateByFleet = new Map(
    states.map((state) => [state.fleetId, state] as const),
  );
  for (const lock of input.locks ?? []) {
    const state = stateByFleet.get(lock.fleetId);
    if (state === undefined) continue;
    for (const batchId of lock.sequence) {
      if (placed.has(batchId)) continue;
      const stop = stopByBatch.get(batchId);
      if (stop === undefined || !canServe(state, stop, input)) break;
      applyStop(state, stop, input);
      placed.add(batchId);
    }
  }
};

const pickVehicle = (
  states: readonly VehicleState[],
  stop: GreedyStopInput,
  input: GreedyInput,
): VehicleState | null => {
  let best: VehicleState | null = null;
  let bestTravel = Number.POSITIVE_INFINITY;
  for (const state of states) {
    if (!canServe(state, stop, input)) continue;
    const travel = travelSeconds(
      input.durationsSeconds,
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

const assignRemaining = (
  input: GreedyInput,
  states: readonly VehicleState[],
  ordered: readonly GreedyStopInput[],
  placed: Set<string>,
): void => {
  for (const stop of ordered) {
    if (placed.has(stop.batchId)) continue;
    const vehicle = pickVehicle(states, stop, input);
    if (vehicle === null) continue;
    applyStop(vehicle, stop, input);
    placed.add(stop.batchId);
  }
};

const resolveReason = (
  stop: GreedyStopInput,
  input: GreedyInput,
): GreedyReason => {
  if (exceedsAllCapacities(stop.kg, input.vehicles)) return 'KAPASITAS';
  const fromDepot = travelSeconds(
    input.durationsSeconds,
    DEPOT_NODE_INDEX,
    stop.nodeIndex,
  );
  const arrivalMs = input.startEpochMs + fromDepot * 1000;
  if (exceedsDeadline(arrivalMs, stop.deadlineMs)) return 'BATAS_WAKTU';
  if (
    input.maxSeconds !== null &&
    input.maxSeconds !== undefined &&
    departureSeconds(fromDepot, stop.readyMs, input.serviceSecondsPerStop) >
      input.maxSeconds
  ) {
    return 'BATAS_WAKTU';
  }
  return 'TIDAK_TERJADWAL';
};

const toAssignments = (
  states: readonly VehicleState[],
): readonly GreedyAssignment[] =>
  Object.freeze(
    states
      .filter((state) => state.sequence.length > 0)
      .map((state) =>
        Object.freeze({
          fleetId: state.fleetId,
          sequence: Object.freeze([...state.sequence]),
          totalKg: state.loadKg,
          estimatedSeconds: Math.round(state.elapsedSeconds),
          lateRiskKg: state.lateRiskKg,
        }),
      ),
  );

export const countHonoredLocks = (
  locks: readonly GreedyLock[],
  assignments: readonly GreedyAssignment[],
): number => {
  const fleetByBatch = new Map<string, string>();
  for (const assignment of assignments) {
    for (const batchId of assignment.sequence) {
      fleetByBatch.set(batchId, assignment.fleetId);
    }
  }
  let honored = 0;
  for (const lock of locks) {
    for (const batchId of lock.sequence) {
      if (fleetByBatch.get(batchId) === lock.fleetId) honored += 1;
    }
  }
  return honored;
};

export const planGreedy = (input: GreedyInput): GreedyOutcome => {
  const states = createStates(input);
  const stopByBatch = new Map(
    input.stops.map((stop) => [stop.batchId, stop] as const),
  );
  const ordered = [...input.stops].sort(
    buildStopComparator(input.durationsSeconds),
  );
  const placed = new Set<string>();
  seedLocks(input, states, stopByBatch, placed);
  assignRemaining(input, states, ordered, placed);
  const unassigned = Object.freeze(
    input.stops
      .filter((stop) => !placed.has(stop.batchId))
      .map((stop) =>
        Object.freeze({
          batchId: stop.batchId,
          reason: resolveReason(stop, input),
        }),
      ),
  );
  return Object.freeze({
    assignments: toAssignments(states),
    unassigned,
  });
};
