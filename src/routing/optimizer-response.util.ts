import {
  OPTIMIZER_STATUSES,
  OPTIMIZER_STRATEGIES,
  OPTIMIZER_UNASSIGNED_REASONS,
  type OptimizerResponse,
  type OptimizerRoute,
  type OptimizerStatus,
  type OptimizerStrategy,
  type OptimizerUnassigned,
  type OptimizerUnassignedReason,
} from './optimizer.contract.js';

const MAX_ROUTES = 64;
const MAX_SEQUENCE_PER_ROUTE = 256;
const MAX_TOTAL_SEQUENCE = 2048;
const MAX_SECONDS = 172800;
const MAX_KG = 100000;
const MAX_UNASSIGNED = 2048;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isFiniteWithin = (
  value: unknown,
  min: number,
  max: number,
): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 64;

const isOptimizerStatus = (value: unknown): value is OptimizerStatus =>
  typeof value === 'string' &&
  (OPTIMIZER_STATUSES as readonly string[]).includes(value);

const isUnassignedReason = (
  value: unknown,
): value is OptimizerUnassignedReason =>
  typeof value === 'string' &&
  (OPTIMIZER_UNASSIGNED_REASONS as readonly string[]).includes(value);

const isOptimizerStrategy = (value: unknown): value is OptimizerStrategy =>
  typeof value === 'string' &&
  (OPTIMIZER_STRATEGIES as readonly string[]).includes(value);

const parseUnassigned = (value: unknown): OptimizerUnassigned | null => {
  if (isNonEmptyString(value)) {
    return Object.freeze({ batchId: value, reason: 'OPTIMIZER' as const });
  }
  if (!isRecord(value)) return null;
  const { batchId, reason } = value;
  if (!isNonEmptyString(batchId)) return null;
  return Object.freeze({
    batchId,
    reason: isUnassignedReason(reason) ? reason : 'TIDAK_TERJADWAL',
  });
};

const parseRoute = (value: unknown): OptimizerRoute | null => {
  if (!isRecord(value)) return null;
  const { fleetId, sequence, totalKg, estimatedSeconds, lateRiskKg } = value;
  if (!isNonEmptyString(fleetId)) return null;
  if (!Array.isArray(sequence) || sequence.length > MAX_SEQUENCE_PER_ROUTE) {
    return null;
  }
  const stops: string[] = [];
  for (const entry of sequence) {
    if (!isNonEmptyString(entry)) return null;
    stops.push(entry);
  }
  if (!isFiniteWithin(totalKg, 0, MAX_KG)) return null;
  if (!isFiniteWithin(estimatedSeconds, 0, MAX_SECONDS)) return null;
  if (!isFiniteWithin(lateRiskKg, 0, MAX_KG)) return null;
  return Object.freeze({
    fleetId,
    sequence: Object.freeze(stops),
    totalKg,
    estimatedSeconds,
    lateRiskKg,
  });
};

export const parseOptimizerResponse = (
  value: unknown,
): OptimizerResponse | null => {
  if (!isRecord(value)) return null;
  if (!isOptimizerStatus(value.status)) return null;
  if (!Array.isArray(value.routes) || value.routes.length > MAX_ROUTES) {
    return null;
  }
  const routes: OptimizerRoute[] = [];
  let totalSequence = 0;
  for (const entry of value.routes) {
    const route = parseRoute(entry);
    if (route === null) return null;
    totalSequence += route.sequence.length;
    if (totalSequence > MAX_TOTAL_SEQUENCE) return null;
    routes.push(route);
  }
  if (
    !Array.isArray(value.unassigned) ||
    value.unassigned.length > MAX_UNASSIGNED
  ) {
    return null;
  }
  const unassigned: OptimizerUnassigned[] = [];
  for (const entry of value.unassigned) {
    const parsed = parseUnassigned(entry);
    if (parsed === null) return null;
    unassigned.push(parsed);
  }
  if (!isRecord(value.solverStats)) return null;
  const { objective, timeSeconds, strategy } = value.solverStats;
  if (typeof objective !== 'number' || !Number.isFinite(objective)) return null;
  if (!isFiniteWithin(timeSeconds, 0, MAX_SECONDS)) return null;
  const planId =
    value.planId === null
      ? null
      : isNonEmptyString(value.planId)
        ? value.planId
        : null;

  return Object.freeze({
    status: value.status,
    planId,
    routes: Object.freeze(routes),
    unassigned: Object.freeze(unassigned),
    solverStats: Object.freeze({
      objective,
      timeSeconds,
      ...(isOptimizerStrategy(strategy) ? { strategy } : {}),
    }),
  });
};
