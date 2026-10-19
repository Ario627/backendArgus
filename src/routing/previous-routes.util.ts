import type { OptimizerPreviousRoute } from './optimizer.contract.js';

const MAX_ROUTES = 64;
const MAX_SEQUENCE = 500;

export interface PreviousStopRow {
  readonly fleetId: string;
  readonly batchId: string;
}

export const groupPreviousRoutes = (
  rows: readonly PreviousStopRow[],
): readonly OptimizerPreviousRoute[] => {
  const byFleet = new Map<string, string[]>();
  for (const row of rows) {
    const sequence = byFleet.get(row.fleetId);
    if (sequence === undefined) {
      if (byFleet.size >= MAX_ROUTES) continue;
      byFleet.set(row.fleetId, [row.batchId]);
      continue;
    }
    if (sequence.length >= MAX_SEQUENCE) continue;
    sequence.push(row.batchId);
  }
  const routes: OptimizerPreviousRoute[] = [];
  for (const [fleetId, sequence] of byFleet) {
    if (sequence.length === 0) continue;
    routes.push(
      Object.freeze({ fleetId, sequence: Object.freeze([...sequence]) }),
    );
  }
  return Object.freeze(routes);
};
