import {
  LEFTOVER_LEVEL_MAX,
  LEFTOVER_LEVEL_MIN,
  leftoverFractionOfLevel,
} from './leftover-scale.util.js';
import { describe, expect, it } from '@jest/globals';


describe('leftoverFractionOfLevel', () => {
  it('memetakan skala 0-4 secara linear ke proporsi 0-1', () => {
    expect(LEFTOVER_LEVEL_MIN).toBe(0);
    expect(LEFTOVER_LEVEL_MAX).toBe(4);
    expect(leftoverFractionOfLevel(0)).toBe(0);
    expect(leftoverFractionOfLevel(1)).toBe(0.25);
    expect(leftoverFractionOfLevel(2)).toBe(0.5);
    expect(leftoverFractionOfLevel(3)).toBe(0.75);
    expect(leftoverFractionOfLevel(4)).toBe(1);
  });

  it('menolak nilai di luar skala atau bukan bilangan bulat', () => {
    expect(() => leftoverFractionOfLevel(5)).toThrow(RangeError);
    expect(() => leftoverFractionOfLevel(-1)).toThrow(RangeError);
    expect(() => leftoverFractionOfLevel(2.5)).toThrow(RangeError);
    expect(() => leftoverFractionOfLevel(Number.NaN)).toThrow(RangeError);
  });
});