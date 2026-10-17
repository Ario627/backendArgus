const HUNDREDTHS_SCALE = 2;

const shiftDecimal = (value: number, exponent: number): number => {
  const text = `${value}`;
  if (text.includes('e') || text.includes('E')) {
    return value * 10 ** exponent;
  }
  return Number(`${text}e${exponent}`);
};

const assertFinite = (value: number): void => {
  if (!Number.isFinite(value)) throw new RangeError('DECIMAL_NOT_FINITE');
};

export const toHundredths = (value: number): number => {
  assertFinite(value);
  const shifted = shiftDecimal(value, HUNDREDTHS_SCALE);
  if (!Number.isFinite(shifted))
    throw new RangeError('DECIMAL_RANGE_UNSUPPORTED');
  const magnitude = Math.round(Math.abs(shifted));
  return shifted < 0 ? -magnitude : magnitude;
};

export const fromHundredths = (hundredths: number): number => {
  if (!Number.isSafeInteger(hundredths))
    throw new RangeError('DECIMAL_HUNDREDTHS_NOT_INTEGER');
  const result = shiftDecimal(hundredths, -HUNDREDTHS_SCALE);
  return result === 0 ? 0 : result;
};

export const roundTo2 = (value: number): number =>
  fromHundredths(toHundredths(value));

export const sumTo2 = (values: readonly number[]): number => {
  let total = 0;
  for (const value of values) {
    total += toHundredths(value);
  }
  return fromHundredths(total);
};

export const diffTo2 = (left: number, right: number): number =>
  fromHundredths(toHundredths(left) - toHundredths(right));
