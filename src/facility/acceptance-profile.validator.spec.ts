import type { ProfileViolation } from './acceptance-profile.types.js';
import { parseAcceptanceProfile } from './acceptance-profile.validator.js';
import { describe, expect, it } from '@jest/globals';


const CANONICAL_PROFILE = {
  acceptsFractions: ['A', 'B', 'C'],
  moisture: { passMin: 45, passMax: 75, fixAbove: 75, rejectAbove: 80 },
  maxAgeHours: null,
  contaminant: { plasticPercentMax: 0, visibleOil: 'fix' },
  capacityKgPerDay: null,
  operatingHours: '06:00-16:00',
  pricePerKg: null,
} as const;

const violationsOf = (value: unknown): readonly ProfileViolation[] => {
  const result = parseAcceptanceProfile(value);
  return result.ok ? [] : result.violations;
};

const rulesOf = (value: unknown): readonly string[] => violationsOf(value).map((entry) => entry.rule);

describe('parseAcceptanceProfile', () => {
  it('menerima bentuk kanonik dari dokumen dan membekukan hasilnya', () => {
    const result = parseAcceptanceProfile(CANONICAL_PROFILE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toEqual(CANONICAL_PROFILE);
    expect(Object.isFrozen(result.profile)).toBe(true);
    expect(Object.isFrozen(result.profile.moisture)).toBe(true);
    expect(Object.isFrozen(result.profile.contaminant)).toBe(true);
    expect(Object.isFrozen(result.profile.acceptsFractions)).toBe(true);
  });

  it('menolak nilai yang bukan objek', () => {
    for (const invalid of [null, 'profil', 42, [], true]) {
      expect(rulesOf(invalid)).toEqual(['PROFILE_INVALID']);
    }
  });

  it('melaporkan kunci wajib yang hilang', () => {
    const { maxAgeHours: _ignored, ...withoutMaxAge } = CANONICAL_PROFILE;
    expect(rulesOf(withoutMaxAge)).toContain('PROFILE_KEY_MISSING');
  });

  it('menolak kunci di luar bentuk kanonik, termasuk anotasi dokumen', () => {
    expect(rulesOf({ ...CANONICAL_PROFILE, hargaKarbon: 10 })).toEqual(['PROFILE_KEY_UNKNOWN']);
    expect(rulesOf({ ...CANONICAL_PROFILE, navigasiCatatan: 'contoh' })).toEqual(['PROFILE_KEY_UNKNOWN']);
  });

  it('memvalidasi komposisi fraksi', () => {
    expect(rulesOf({ ...CANONICAL_PROFILE, acceptsFractions: [] })).toEqual(['FRACTIONS_INVALID']);
    expect(rulesOf({ ...CANONICAL_PROFILE, acceptsFractions: 'ABC' })).toEqual(['FRACTIONS_INVALID']);
    expect(rulesOf({ ...CANONICAL_PROFILE, acceptsFractions: ['A', 'Z'] })).toEqual(['FRACTIONS_INVALID_CODE']);
    expect(rulesOf({ ...CANONICAL_PROFILE, acceptsFractions: ['A', 'A'] })).toEqual(['FRACTIONS_DUPLICATE']);
    expect(rulesOf({ ...CANONICAL_PROFILE, acceptsFractions: ['D', 'E'] })).toEqual([]);
  });

  it('menegakkan urutan kadar air hanya pada pasangan yang terisi', () => {
    const outOfOrder = { passMin: 80, passMax: 75, fixAbove: 75, rejectAbove: 80 };
    expect(rulesOf({ ...CANONICAL_PROFILE, moisture: outOfOrder })).toContain('MOISTURE_ORDER');

    const equalFirstPair = { passMin: 75, passMax: 75, fixAbove: 75, rejectAbove: 80 };
    expect(rulesOf({ ...CANONICAL_PROFILE, moisture: equalFirstPair })).toContain('MOISTURE_ORDER');

    const equalTail = { passMin: 45, passMax: 75, fixAbove: 75, rejectAbove: 75 };
    expect(rulesOf({ ...CANONICAL_PROFILE, moisture: equalTail })).toEqual([]);

    const allNull = { passMin: null, passMax: null, fixAbove: null, rejectAbove: null };
    expect(rulesOf({ ...CANONICAL_PROFILE, moisture: allNull })).toEqual([]);
  });

  it('menolak angka kadar air di luar rentang atau bertipe salah', () => {
    const tooHigh = { passMin: 101, passMax: 75, fixAbove: 75, rejectAbove: 80 };
    expect(rulesOf({ ...CANONICAL_PROFILE, moisture: tooHigh })).toContain('MOISTURE_RANGE');
    const asString = { passMin: '45', passMax: 75, fixAbove: 75, rejectAbove: 80 };
    expect(rulesOf({ ...CANONICAL_PROFILE, moisture: asString })).toContain('MOISTURE_RANGE');
  });

  it('mewajibkan seluruh kunci moisture dan menolak kunci asing', () => {
    expect(rulesOf({ ...CANONICAL_PROFILE, moisture: { passMin: 45 } })).toContain('MOISTURE_KEY_MISSING');
    const withPh = { ...CANONICAL_PROFILE.moisture, ph: 7 };
    expect(rulesOf({ ...CANONICAL_PROFILE, moisture: withPh })).toEqual(['MOISTURE_KEY_UNKNOWN']);
  });

  it('memvalidasi kontaminan', () => {
    const plasticTooHigh = { plasticPercentMax: 101, visibleOil: 'fix' };
    expect(rulesOf({ ...CANONICAL_PROFILE, contaminant: plasticTooHigh })).toEqual(['CONTAMINANT_PLASTIC_RANGE']);
    const badPolicy = { plasticPercentMax: 0, visibleOil: 'buang' };
    expect(rulesOf({ ...CANONICAL_PROFILE, contaminant: badPolicy })).toEqual(['CONTAMINANT_OIL_INVALID']);
    const nullPolicy = { plasticPercentMax: 0, visibleOil: null };
    expect(rulesOf({ ...CANONICAL_PROFILE, contaminant: nullPolicy })).toEqual(['CONTAMINANT_OIL_INVALID']);
    const withBau = { ...CANONICAL_PROFILE.contaminant, bau: true };
    expect(rulesOf({ ...CANONICAL_PROFILE, contaminant: withBau })).toEqual(['CONTAMINANT_KEY_UNKNOWN']);
  });

  it('memvalidasi angka positif nullable', () => {
    expect(rulesOf({ ...CANONICAL_PROFILE, maxAgeHours: 0 })).toEqual(['MAX_AGE_INVALID']);
    expect(rulesOf({ ...CANONICAL_PROFILE, capacityKgPerDay: -1 })).toEqual(['CAPACITY_INVALID']);
    expect(rulesOf({ ...CANONICAL_PROFILE, pricePerKg: '5000' })).toEqual(['PRICE_INVALID']);
    const filled = { ...CANONICAL_PROFILE, maxAgeHours: 12, capacityKgPerDay: 300, pricePerKg: 1500 };
    expect(rulesOf(filled)).toEqual([]);
  });

  it('memvalidasi format jam operasi', () => {
    expect(rulesOf({ ...CANONICAL_PROFILE, operatingHours: '6:00-16:00' })).toEqual(['OPERATING_HOURS_FORMAT']);
    expect(rulesOf({ ...CANONICAL_PROFILE, operatingHours: 600 })).toEqual(['OPERATING_HOURS_FORMAT']);
    expect(rulesOf({ ...CANONICAL_PROFILE, operatingHours: null })).toEqual([]);
  });

  it('mengumpulkan banyak pelanggaran sekaligus', () => {
    const rules = rulesOf({
      ...CANONICAL_PROFILE,
      acceptsFractions: [],
      moisture: { passMin: 101, passMax: 75, fixAbove: 75, rejectAbove: 80 },
      maxAgeHours: -1,
    });
    expect(rules).toEqual(expect.arrayContaining(['FRACTIONS_INVALID', 'MOISTURE_RANGE', 'MAX_AGE_INVALID']));
  });
});