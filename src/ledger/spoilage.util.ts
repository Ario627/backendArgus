export interface SpoilageInput {
  readonly releasedAt: Date | null;
  readonly receivedAt: Date | null;
  readonly now: Date;
  readonly maxAgeHours: number | null;
}

export interface SpoilageSnapshot {
  readonly maxAgeHours: number | null;
  readonly elapsedHours: number | null;
  readonly late: boolean | null;
}

export const computeSpoilage = (input: SpoilageInput): SpoilageSnapshot => {
  if (input.releasedAt === null) {
    return Object.freeze({ maxAgeHours: input.maxAgeHours, elapsedHours: null, late: null });
  }
  const endMs = (input.receivedAt ?? input.now).getTime();
  const elapsedMs = Math.max(0, endMs - input.releasedAt.getTime());
  const elapsedHours = Math.round((elapsedMs / 3600000) * 10) / 10;
  const late = input.maxAgeHours === null ? null : elapsedHours > input.maxAgeHours;
  return Object.freeze({ maxAgeHours: input.maxAgeHours, elapsedHours, late });
};