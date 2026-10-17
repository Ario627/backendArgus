import type { FractionViolation } from './fraction.util.js';
import { parseBatchFractions } from './fraction.util.js';
import { describe, expect, it } from '@jest/globals';


const codesOf = (result: { readonly ok: boolean } & Record<string, unknown>): readonly string[] =>
  result.ok ? [] : (result.violations as readonly FractionViolation[]).map((entry) => entry.code);

describe('parseBatchFractions', () => {
  it('menerima komposisi valid aliran organik', () => {
    const result = parseBatchFractions('organik', { A: 40, B: 45, C: 10, E: 5 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fractions).toEqual({ A: 40, B: 45, C: 10, E: 5 });
    expect(Object.isFrozen(result.fractions)).toBe(true);
  });

  it('membuang nilai nol dari komposisi tersimpan', () => {
    const result = parseBatchFractions('organik', { A: 100, B: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fractions).toEqual({ A: 100 });
  });

  it('menolak kunci fraksi yang tidak dikenal', () => {
    expect(codesOf(parseBatchFractions('organik', { A: 90, Z: 10 }))).toEqual(['FRACTION_UNKNOWN_KEY']);
    expect(codesOf(parseBatchFractions('organik', { a: 90 }))).toEqual(['FRACTION_UNKNOWN_KEY']);
  });

  it('menolak nilai di luar rentang atau bukan angka', () => {
    expect(codesOf(parseBatchFractions('organik', { A: 101 }))).toEqual(['FRACTION_VALUE_RANGE']);
    expect(codesOf(parseBatchFractions('organik', { A: -1 }))).toEqual(['FRACTION_VALUE_RANGE']);
    expect(codesOf(parseBatchFractions('organik', { A: 'empat puluh' } as never))).toEqual([
      'FRACTION_VALUE_RANGE',
    ]);
  });

  it('menegakkan total maksimum 100 dengan aritmetika perseratus', () => {
    expect(codesOf(parseBatchFractions('organik', { A: 33.33, B: 33.33, C: 33.33 }))).toEqual([]);
    expect(codesOf(parseBatchFractions('organik', { A: 33.34, B: 33.33, C: 33.33 }))).toEqual([]);
    expect(codesOf(parseBatchFractions('organik', { A: 50.01, B: 50 }))).toEqual(['FRACTION_SUM_OVER']);
  });

  it('mewajibkan komposisi untuk aliran organik dan melarangnya untuk minyak', () => {
    expect(codesOf(parseBatchFractions('organik', {}))).toEqual(['FRACTION_REQUIRED_FOR_ORGANIK']);
    expect(codesOf(parseBatchFractions('minyak', { A: 10 }))).toEqual(['FRACTION_NOT_ALLOWED_FOR_MINYAK']);
    expect(parseBatchFractions('minyak', {}).ok).toBe(true);
  });
});