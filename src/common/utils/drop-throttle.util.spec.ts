import { describe, expect, it } from '@jest/globals';
import { DropThrottle } from './drop-throttle.util.js';

describe('DropThrottle', () => {
  it('mengizinkan satu log per jendela interval per kunci', () => {
    const throttle = new DropThrottle(1000);
    expect(throttle.shouldLog('fleet-1', 0)).toBe(true);
    expect(throttle.shouldLog('fleet-1', 500)).toBe(false);
    expect(throttle.shouldLog('fleet-1', 1000)).toBe(true);
    expect(throttle.shouldLog('fleet-2', 1000)).toBe(true);
  });

  it('menjaga jumlah kunci agar memori tidak tumbuh tanpa batas', () => {
    const throttle = new DropThrottle(0, 2);
    expect(throttle.shouldLog('a', 0)).toBe(true);
    expect(throttle.shouldLog('b', 0)).toBe(true);
    expect(throttle.shouldLog('c', 0)).toBe(true);
    expect(throttle.shouldLog('a', 0)).toBe(true);
  });
});