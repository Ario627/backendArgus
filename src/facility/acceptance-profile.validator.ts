import { FRACTION_CODES, type FractionCode } from '../common/constant/domain.constant.js';
import {
  VISIBLE_OIL_POLICIES,
  type AcceptanceProfileRules,
  type ContaminantRules,
  type MoistureRules,
  type ProfileParseResult,
  type ProfileViolation,
  type VisibleOilPolicy,
} from './acceptance-profile.types.js';

const PROFILE_KEYS = [
  'acceptsFractions',
  'moisture',
  'maxAgeHours',
  'contaminant',
  'capacityKgPerDay',
  'operatingHours',
  'pricePerKg',
] as const;

const MOISTURE_FIELDS = ['passMin', 'passMax', 'fixAbove', 'rejectAbove'] as const;
const CONTAMINANT_KEYS = ['plasticPercentMax', 'visibleOil'] as const;
const OPERATING_HOURS_PATTERN = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
const FRACTION_CODE_SET: ReadonlySet<string> = new Set(FRACTION_CODES);
const OIL_POLICY_SET: ReadonlySet<string> = new Set(VISIBLE_OIL_POLICIES);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (source: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(source, key);

const violation = (rule: string, path: string, detail: string): ProfileViolation => ({
  rule,
  path,
  detail,
});

const unknownKeysOf = (source: Record<string, unknown>, allowed: readonly string[]): readonly string[] =>
  Object.keys(source).filter((key) => !allowed.includes(key));

const isFractionCode = (value: string): value is FractionCode => FRACTION_CODE_SET.has(value);

const isOilPolicy = (value: string): value is VisibleOilPolicy => OIL_POLICY_SET.has(value);

const isNullablePercentage = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100);

const validateFractions = (
  value: unknown,
  violations: ProfileViolation[],
): readonly FractionCode[] | null => {
  if (!Array.isArray(value) || value.length === 0) {
    violations.push(
      violation('FRACTIONS_INVALID', 'acceptsFractions', 'acceptsFractions harus berisi minimal satu kode fraksi A-E'),
    );
    return null;
  }
  const seen = new Set<string>();
  const codes: FractionCode[] = [];
  let valid = true;
  for (const entry of value) {
    if (typeof entry !== 'string' || !isFractionCode(entry)) {
      violations.push(
        violation('FRACTIONS_INVALID_CODE', 'acceptsFractions', `Kode fraksi tidak dikenal: ${String(entry)}`),
      );
      valid = false;
      continue;
    }
    if (seen.has(entry)) {
      violations.push(violation('FRACTIONS_DUPLICATE', 'acceptsFractions', `Kode fraksi ganda: ${entry}`));
      valid = false;
      continue;
    }
    seen.add(entry);
    codes.push(entry);
  }
  return valid ? codes : null;
};

const validateMoistureOrder = (rules: MoistureRules, violations: ProfileViolation[]): void => {
  const chain: readonly (readonly [string, number | null])[] = [
    ['passMin', rules.passMin],
    ['passMax', rules.passMax],
    ['fixAbove', rules.fixAbove],
    ['rejectAbove', rules.rejectAbove],
  ];
  for (let index = 0; index < chain.length - 1; index += 1) {
    const [leftName, left] = chain[index];
    const [rightName, right] = chain[index + 1];
    if (left === null || right === null) continue;
    const ordered = index === 0 ? left < right : left <= right;
    if (!ordered) {
      violations.push(
        violation(
          'MOISTURE_ORDER',
          'moisture',
          `moisture.${leftName} harus ${index === 0 ? 'lebih kecil dari' : 'tidak lebih dari'} moisture.${rightName}`,
        ),
      );
    }
  }
};

const validateMoisture = (value: unknown, violations: ProfileViolation[]): MoistureRules | null => {
  if (!isRecord(value)) {
    violations.push(violation('MOISTURE_INVALID', 'moisture', 'moisture harus berupa objek'));
    return null;
  }
  for (const key of unknownKeysOf(value, MOISTURE_FIELDS)) {
    violations.push(violation('MOISTURE_KEY_UNKNOWN', `moisture.${key}`, `Kunci moisture tidak dikenal: ${key}`));
  }
  const rules: {
    passMin: number | null;
    passMax: number | null;
    fixAbove: number | null;
    rejectAbove: number | null;
  } = { passMin: null, passMax: null, fixAbove: null, rejectAbove: null };
  for (const field of MOISTURE_FIELDS) {
    if (!hasOwn(value, field)) {
      violations.push(
        violation('MOISTURE_KEY_MISSING', `moisture.${field}`, `Kunci wajib hilang: moisture.${field}`),
      );
      continue;
    }
    const raw = value[field];
    if (!isNullablePercentage(raw)) {
      violations.push(
        violation('MOISTURE_RANGE', `moisture.${field}`, `moisture.${field} harus angka 0-100 atau null`),
      );
      continue;
    }
    rules[field] = raw;
  }
  validateMoistureOrder(rules, violations);
  return rules;
};

const validateContaminant = (value: unknown, violations: ProfileViolation[]): ContaminantRules | null => {
  if (!isRecord(value)) {
    violations.push(violation('CONTAMINANT_INVALID', 'contaminant', 'contaminant harus berupa objek'));
    return null;
  }
  for (const key of unknownKeysOf(value, CONTAMINANT_KEYS)) {
    violations.push(
      violation('CONTAMINANT_KEY_UNKNOWN', `contaminant.${key}`, `Kunci contaminant tidak dikenal: ${key}`),
    );
  }

  let plasticPercentMax: number | null = null;
  if (!hasOwn(value, 'plasticPercentMax')) {
    violations.push(
      violation(
        'CONTAMINANT_KEY_MISSING',
        'contaminant.plasticPercentMax',
        'Kunci wajib hilang: contaminant.plasticPercentMax',
      ),
    );
  } else if (!isNullablePercentage(value.plasticPercentMax)) {
    violations.push(
      violation(
        'CONTAMINANT_PLASTIC_RANGE',
        'contaminant.plasticPercentMax',
        'contaminant.plasticPercentMax harus angka 0-100 atau null',
      ),
    );
  } else {
    plasticPercentMax = value.plasticPercentMax;
  }

  if (!hasOwn(value, 'visibleOil')) {
    violations.push(
      violation('CONTAMINANT_KEY_MISSING', 'contaminant.visibleOil', 'Kunci wajib hilang: contaminant.visibleOil'),
    );
    return null;
  }
  const oilRaw = value.visibleOil;
  if (typeof oilRaw !== 'string' || !isOilPolicy(oilRaw)) {
    violations.push(
      violation(
        'CONTAMINANT_OIL_INVALID',
        'contaminant.visibleOil',
        'contaminant.visibleOil harus fix, reject, atau allow',
      ),
    );
    return null;
  }
  return { plasticPercentMax, visibleOil: oilRaw };
};

const readNullablePositive = (
  source: Record<string, unknown>,
  key: string,
  rule: string,
  violations: ProfileViolation[],
): number | null => {
  if (!hasOwn(source, key)) return null;
  const raw = source[key];
  if (raw === null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  violations.push(violation(rule, key, `${key} harus angka positif atau null`));
  return null;
};

const readOperatingHours = (source: Record<string, unknown>, violations: ProfileViolation[]): string | null => {
  if (!hasOwn(source, 'operatingHours')) return null;
  const raw = source.operatingHours;
  if (raw === null) return null;
  if (typeof raw === 'string' && OPERATING_HOURS_PATTERN.test(raw)) return raw;
  violations.push(
    violation('OPERATING_HOURS_FORMAT', 'operatingHours', 'operatingHours harus format HH:MM-HH:MM atau null'),
  );
  return null;
};

export const parseAcceptanceProfile = (value: unknown): ProfileParseResult => {
  if (!isRecord(value)) {
    return {
      ok: false,
      violations: [violation('PROFILE_INVALID', '', 'Profil penerimaan harus berupa objek JSON')],
    };
  }

  const violations: ProfileViolation[] = [];
  for (const key of unknownKeysOf(value, PROFILE_KEYS)) {
    violations.push(violation('PROFILE_KEY_UNKNOWN', key, `Kunci tidak dikenal: ${key}`));
  }
  for (const key of PROFILE_KEYS) {
    if (!hasOwn(value, key)) {
      violations.push(violation('PROFILE_KEY_MISSING', key, `Kunci wajib hilang: ${key}`));
    }
  }

  const acceptsFractions = hasOwn(value, 'acceptsFractions')
    ? validateFractions(value.acceptsFractions, violations)
    : null;
  const moisture = hasOwn(value, 'moisture') ? validateMoisture(value.moisture, violations) : null;
  const contaminant = hasOwn(value, 'contaminant') ? validateContaminant(value.contaminant, violations) : null;
  const maxAgeHours = readNullablePositive(value, 'maxAgeHours', 'MAX_AGE_INVALID', violations);
  const capacityKgPerDay = readNullablePositive(value, 'capacityKgPerDay', 'CAPACITY_INVALID', violations);
  const pricePerKg = readNullablePositive(value, 'pricePerKg', 'PRICE_INVALID', violations);
  const operatingHours = readOperatingHours(value, violations);

  if (violations.length > 0) return { ok: false, violations };
  if (acceptsFractions === null || moisture === null || contaminant === null) {
    return { ok: false, violations: [violation('PROFILE_INVALID', '', 'Profil penerimaan tidak lengkap')] };
  }

  return {
    ok: true,
    profile: Object.freeze({
      acceptsFractions: Object.freeze([...acceptsFractions]),
      moisture: Object.freeze({ ...moisture }),
      maxAgeHours,
      contaminant: Object.freeze({ ...contaminant }),
      capacityKgPerDay,
      operatingHours,
      pricePerKg,
    }),
  };
};