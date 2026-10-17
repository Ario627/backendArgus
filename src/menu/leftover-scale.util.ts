export const LEFTOVER_LEVEL_MIN = 0;
export const LEFTOVER_LEVEL_MAX = 4;

export const leftoverFractionOfLevel = (level: number): number => {
  if (!Number.isInteger(level) || level < LEFTOVER_LEVEL_MIN || level > LEFTOVER_LEVEL_MAX) {
    throw new RangeError('LEFTOVER_LEVEL_INVALID');
  }
  return level / LEFTOVER_LEVEL_MAX;
};