export const WIB_UTC_OFFSET_HOURS = 7;

const DAY_MS = 86400000;
const WIB_OFFSET_MS = WIB_UTC_OFFSET_HOURS * 3600000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface UtcDayRange {
  readonly date: string;
  readonly start: Date;
  readonly end: Date;
}

export const jakartaDateOf = (instant: Date): string =>
  new Date(instant.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);

export const wibDayRangeUtc = (date: string): UtcDayRange => {
  if (!DATE_PATTERN.test(date)) throw new RangeError('DATE_FORMAT_INVALID');
  const startMs = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(startMs)) throw new RangeError('DATE_INVALID');
  const start = startMs - WIB_OFFSET_MS;
  return Object.freeze({ date, start: new Date(start), end: new Date(start + DAY_MS) });
};