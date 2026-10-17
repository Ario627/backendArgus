import { jakartaDateOf, WIB_UTC_OFFSET_HOURS, wibDayRangeUtc } from './daily-range.util.js';
import { describe, expect, it } from '@jest/globals';

describe('wibDayRangeUtc', () => {
  it('menggeser batas hari tujuh jam ke belakang dari tengah malam UTC', () => {
    expect(WIB_UTC_OFFSET_HOURS).toBe(7);
    const range = wibDayRangeUtc('2026-10-17');
    expect(range.start.toISOString()).toBe('2026-10-16T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-10-17T17:00:00.000Z');
    expect(Object.isFrozen(range)).toBe(true);
  });

  it('menolak format tanggal yang salah', () => {
    expect(() => wibDayRangeUtc('17-10-2026')).toThrow(RangeError);
    expect(() => wibDayRangeUtc('2026/10/17')).toThrow(RangeError);
    expect(() => wibDayRangeUtc('')).toThrow(RangeError);
  });
});

describe('jakartaDateOf', () => {
  it('membaca tanggal WIB yang benar di kedua sisi tengah malam', () => {
    expect(jakartaDateOf(new Date('2026-10-16T16:59:59.000Z'))).toBe('2026-10-16');
    expect(jakartaDateOf(new Date('2026-10-16T17:00:00.000Z'))).toBe('2026-10-17');
    expect(jakartaDateOf(new Date('2026-10-17T10:30:00.000Z'))).toBe('2026-10-17');
  });
});