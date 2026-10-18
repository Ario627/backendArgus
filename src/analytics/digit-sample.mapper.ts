import type { AnalyticsSample } from './analytics.contract.js';

const WEIGHT_DECIMALS = 2;

export const toAnalyticsSample = (
  batchId: string,
  beratKg: string,
  occurredAt: Date,
  fromDevice: boolean,
): AnalyticsSample =>
  Object.freeze({
    batchId,
    weightKg: Number(Number(beratKg).toFixed(WEIGHT_DECIMALS)),
    occurredAt: occurredAt.toISOString(),
    origin: fromDevice ? ('device' as const) : ('manual' as const),
  });