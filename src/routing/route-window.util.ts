const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;

export const clockMinutes = (value: string): number | null => {
  const match = CLOCK_PATTERN.exec(value);
  if (match === null) return null;
  const hours = Number.parseInt(match[1] ?? '', 10);
  const minutes = Number.parseInt(match[2] ?? '', 10);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return hours * MINUTES_PER_HOUR + minutes;
};

export const windowSeconds = (start: string, end: string): number | null => {
  const startMinutes = clockMinutes(start);
  const endMinutes = clockMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;
  if (endMinutes <= startMinutes) return null;
  return (endMinutes - startMinutes) * SECONDS_PER_MINUTE;
};
