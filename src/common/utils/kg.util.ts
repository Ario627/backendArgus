const KG_SCALE = 2;

const shiftDecimal = (value: number, exponent: number): number => {
  const text = `${value}`;
  if (text.includes('e') || text.includes('E')) {
    return value * 10 ** exponent;
  }
  return Number(`${text}e${exponent}`);
};

const assertFinite = (value: number): void => {
  if (!Number.isFinite(value)) throw new RangeError('KG_NOT_FINITE');
};

export const toKgHundredths = (value: number): number => {
  assertFinite(value);
  const shifted = shiftDecimal(value, KG_SCALE);
  if (!Number.isFinite(shifted)) throw new RangeError('KG_RANGE_UNSUPPORTED');
  const magnitude = Math.round(Math.abs(shifted));
  return shifted < 0 ? -magnitude : magnitude;
};

export const fromKgHundredths = (hundredths: number): number => {
  if (!Number.isSafeInteger(hundredths)) throw new RangeError('KG_HUNDREDTHS_NOT_INTEGER');
  const result = shiftDecimal(hundredths, -KG_SCALE);
  return result === 0 ? 0 : result;
};

export const roundKg = (value: number): number => fromKgHundredths(toKgHundredths(value));

export const sumKg = (values: readonly number[]): number => {
  let total = 0;
  for (const value of values) {
    total += toKgHundredths(value);
  }
  return fromKgHundredths(total);
};

export const diffKg = (left: number, right: number): number =>
  fromKgHundredths(toKgHundredths(left) - toKgHundredths(right));