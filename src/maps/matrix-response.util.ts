const MAX_DURATION_SECONDS = 172800;
const MAX_DISTANCE_METERS = 5000000;

export interface MapboxMatrixCells {
  readonly durationsSeconds: readonly (readonly number[])[];
  readonly distancesMeters: readonly (readonly number[])[];
}

const isMatrixOfSize = (value: unknown, size: number): value is number[][] => {
  if (!Array.isArray(value) || value.length !== size) return false;
  return value.every(
    (row) =>
      Array.isArray(row) &&
      row.length === size &&
      row.every(
        (cell) =>
          typeof cell === 'number' && Number.isFinite(cell) && cell >= 0,
      ),
  );
};

export const parseMapboxMatrix = (
  value: unknown,
  size: number,
): MapboxMatrixCells | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.code !== 'Ok') return null;
  const durations = record.durations;
  const distances = record.distances;
  if (!isMatrixOfSize(durations, size)) return null;
  if (!isMatrixOfSize(distances, size)) return null;
  const durationsSeconds = durations.map((row) =>
    row.map((cell) => Math.min(cell, MAX_DURATION_SECONDS)),
  );
  const distancesMeters = distances.map((row) =>
    row.map((cell) => Math.min(cell, MAX_DISTANCE_METERS)),
  );
  return Object.freeze({
    durationsSeconds: Object.freeze(
      durationsSeconds.map((row) => Object.freeze(row)),
    ),
    distancesMeters: Object.freeze(
      distancesMeters.map((row) => Object.freeze(row)),
    ),
  });
};