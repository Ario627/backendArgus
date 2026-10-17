const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/;
const QUOTE_TRIGGER_PATTERN = /[",\n\r;]/;
const BOM = '\uFEFF';
const EOL = '\r\n';

const scalarOf = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return '';
};

export const csvCell = (value: unknown): string => {
  const raw = scalarOf(value);
  const guarded = FORMULA_PREFIX_PATTERN.test(raw) ? `'${raw}` : raw;
  if (!QUOTE_TRIGGER_PATTERN.test(guarded)) return guarded;
  return `"${guarded.split('"').join('""')}"`;
};

export const csvRow = (cells: readonly unknown[]): string =>
  cells.map(csvCell).join(',');

export const buildCsv = (
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
): string =>
  `${BOM}${[csvRow(header), ...rows.map((row) => csvRow(row))].join(EOL)}${EOL}`;