import {
  FRACTION_CODES,
  type FractionCode,
  type WasteFlow,
} from '../common/constant/domain.constant.js';
import { sumTo2 } from '../common/utils/decimal.util.js';

export const FRACTION_TOTAL_MAX = 100;

export interface FractionViolation {
  readonly code: string;
  readonly field: string;
}

export type FractionParseResult =
  | {
      readonly ok: true;
      readonly fractions: Readonly<Partial<Record<FractionCode, number>>>;
    }
  | { readonly ok: false; readonly violations: readonly FractionViolation[] };

const FRACTION_CODE_SET: ReadonlySet<string> = new Set(FRACTION_CODES);

const isFractionCode = (value: string): value is FractionCode =>
  FRACTION_CODE_SET.has(value);

const isFractionValue = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= FRACTION_TOTAL_MAX;

const readEntries = (
  raw: Readonly<Record<string, unknown>>,
  violations: FractionViolation[],
): readonly (readonly [FractionCode, number])[] => {
  const entries: [FractionCode, number][] = [];
  for (const key of Object.keys(raw)) {
    const value = raw[key];
    if (!isFractionCode(key)) {
      violations.push({
        code: 'FRACTION_UNKNOWN_KEY',
        field: `fractions.${key}`,
      });
      continue;
    }
    if (!isFractionValue(value)) {
      violations.push({
        code: 'FRACTION_VALUE_RANGE',
        field: `fractions.${key}`,
      });
      continue;
    }
    if (value > 0) {
      entries.push([key, value]);
    }
  }
  return entries;
};

export const parseBatchFractions = (
  flow: WasteFlow,
  raw: Readonly<Record<string, unknown>>,
): FractionParseResult => {
  const violations: FractionViolation[] = [];
  const entries = readEntries(raw, violations);
  const total = sumTo2(entries.map(([, value]) => value));

  if (total > FRACTION_TOTAL_MAX) {
    violations.push({ code: 'FRACTION_SUM_OVER', field: 'fractions' });
  }
  if (flow === 'organik' && entries.length === 0 && violations.length === 0) {
    violations.push({
      code: 'FRACTION_REQUIRED_FOR_ORGANIK',
      field: 'fractions',
    });
  }
  if (flow === 'minyak' && entries.length > 0) {
    violations.push({
      code: 'FRACTION_NOT_ALLOWED_FOR_MINYAK',
      field: 'fractions',
    });
  }

  if (violations.length > 0) {
    return { ok: false, violations: Object.freeze(violations) };
  }

  const fractions: Partial<Record<FractionCode, number>> = {};
  for (const [code, value] of entries) {
    fractions[code] = value;
  }
  return { ok: true, fractions: Object.freeze(fractions) };
};
