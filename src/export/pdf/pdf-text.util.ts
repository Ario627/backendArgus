const REPLACEMENT = '?';

const ACCEPTED_EXTRA = new Set<number>([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

const isEncodable = (codePoint: number): boolean => {
  if (codePoint === 0x0a) return true;
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true;
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true;
  return ACCEPTED_EXTRA.has(codePoint);
};

export const ELLIPSIS = '…';

export const toWinAnsiSafe = (input: string): string =>
  Array.from(input)
    .map((char) => (isEncodable(char.codePointAt(0) ?? 0) ? char : REPLACEMENT))
    .join('');

export type MeasureText = (text: string) => number;

export const truncateToWidth = (
  text: string,
  maxWidth: number,
  measure: MeasureText,
): string => {
  const safe = toWinAnsiSafe(text);
  if (measure(safe) <= maxWidth) return safe;
  const chars = Array.from(safe);
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${chars.slice(0, mid).join('')}${ELLIPSIS}`;
    if (measure(candidate) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low === 0 ? '' : `${chars.slice(0, low).join('')}${ELLIPSIS}`;
};

export const formatKg = (value: string | number | null): string => {
  if (value === null) return '-';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return numeric.toFixed(2);
};