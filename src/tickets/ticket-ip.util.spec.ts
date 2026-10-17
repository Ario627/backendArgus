import { describe, expect, it } from '@jest/globals';
import { hashIpPelapor, monthKeyOf } from './ticket-ip.util.js';

const SALT = 'salt-uji-0123456789';
const OKTOBER = new Date('2026-10-16T04:00:00Z');
const NOVEMBER = new Date('2026-11-02T04:00:00Z');

describe('monthKeyOf', () => {
  it('memakai bulan kalender WIB, bukan UTC', () => {
    expect(monthKeyOf(OKTOBER)).toBe('2026-10');
    expect(monthKeyOf(new Date('2026-10-31T17:30:00Z'))).toBe('2026-11');
  });
});

describe('hashIpPelapor', () => {
  it('cocok dengan vektor beku sha256 dan berformat hex 64', () => {
    const hash = hashIpPelapor('203.0.113.7', SALT, OKTOBER);
    expect(hash).toBe(
      '5ac4813deb48255d74a99b9a574c0bb6525dd35910243cc93da2e051d825f10f',
    );
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('stabil dalam bulan yang sama dan berubah saat bulan berganti', () => {
    const oktober = hashIpPelapor('203.0.113.7', SALT, OKTOBER);
    const oktoberLagi = hashIpPelapor(
      '203.0.113.7',
      SALT,
      new Date('2026-10-30T04:00:00Z'),
    );
    expect(oktoberLagi).toBe(oktober);
    expect(hashIpPelapor('203.0.113.7', SALT, NOVEMBER)).toBe(
      '8b748f7e63a64ff1e6a4f5fc8e8e08a00decbcc3e39d2a0c07d1b7c0e631c4cc',
    );
  });

  it('berbeda untuk IP atau salt berbeda', () => {
    const base = hashIpPelapor('203.0.113.7', SALT, OKTOBER);
    expect(hashIpPelapor('203.0.113.8', SALT, OKTOBER)).not.toBe(base);
    expect(hashIpPelapor('203.0.113.7', 'salt-lain', OKTOBER)).not.toBe(base);
  });
});