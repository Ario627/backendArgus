import { describe, expect, it } from '@jest/globals';
import { clockMinutes, windowSeconds } from './route-window.util.js';

describe('clockMinutes', () => {
  it('mengubah jam dan menit menjadi menit', () => {
    expect(clockMinutes('00:00')).toBe(0);
    expect(clockMinutes('09:00')).toBe(540);
    expect(clockMinutes('15:30')).toBe(930);
    expect(clockMinutes('23:59')).toBe(1439);
  });

  it('menolak format yang tidak sah', () => {
    expect(clockMinutes('9:00')).toBeNull();
    expect(clockMinutes('24:00')).toBeNull();
    expect(clockMinutes('09:60')).toBeNull();
    expect(clockMinutes('092:00')).toBeNull();
    expect(clockMinutes('')).toBeNull();
  });
});

describe('windowSeconds', () => {
  it('menghitung durasi jendela kerja', () => {
    expect(windowSeconds('09:00', '15:00')).toBe(21600);
    expect(windowSeconds('06:00', '16:00')).toBe(36000);
    expect(windowSeconds('09:00', '09:30')).toBe(1800);
  });

  it('menolak jendela terbalik atau kosong', () => {
    expect(windowSeconds('15:00', '09:00')).toBeNull();
    expect(windowSeconds('09:00', '09:00')).toBeNull();
  });

  it('menolak salah satu jam yang tidak sah', () => {
    expect(windowSeconds('25:00', '09:00')).toBeNull();
    expect(windowSeconds('09:00', '')).toBeNull();
  });
});
