import { acceptsMinyakOf, readAcceptsFlows, toGateProfile } from './profile.mapper.js';
import { describe, expect, it } from '@jest/globals';


const ATURAN_KANONIK = {
  acceptsFractions: ['A', 'B', 'C'],
  moisture: { passMin: 45, passMax: 75, fixAbove: 75, rejectAbove: 80 },
  maxAgeHours: 12,
  contaminant: { plasticPercentMax: 0, visibleOil: 'fix' },
  capacityKgPerDay: 300,
  operatingHours: '06:00-16:00',
  pricePerKg: 1500,
} as const;

describe('toGateProfile', () => {
  it('memetakan bentuk kanonik tersimpan menjadi profil gerbang', () => {
    const profile = toGateProfile(ATURAN_KANONIK);
    expect(profile).toEqual({
      acceptsFractions: ['A', 'B', 'C'],
      moisture: { passMin: 45, passMax: 75, fixAbove: 75, rejectAbove: 80 },
      maxAgeHours: 12,
      contaminant: { plasticPercentMax: 0, visibleOil: 'fix' },
      capacityKgPerDay: 300,
      operatingHours: '06:00-16:00',
      pricePerKg: 1500,
    });
    expect(Object.isFrozen(profile)).toBe(true);
  });

  it('tidak menebak nilai: data rusak menjadi null, bukan angka karangan', () => {
    const rusak = {
      acceptsFractions: ['A', 'Z'],
      moisture: 'basah',
      maxAgeHours: -1,
      contaminant: { plasticPercentMax: 500, visibleOil: 'buang' },
      capacityKgPerDay: '300',
      operatingHours: '6:00-16:00',
      pricePerKg: 0,
    };
    const profile = toGateProfile(rusak);
    expect(profile.acceptsFractions).toBeNull();
    expect(profile.moisture).toEqual({ passMin: null, passMax: null, fixAbove: null, rejectAbove: null });
    expect(profile.maxAgeHours).toBeNull();
    expect(profile.contaminant).toEqual({ plasticPercentMax: null, visibleOil: null });
    expect(profile.capacityKgPerDay).toBeNull();
    expect(profile.operatingHours).toBeNull();
    expect(profile.pricePerKg).toBeNull();
  });
});

describe('readAcceptsFlows dan acceptsMinyakOf', () => {
  it('default organik saja saat kunci tidak ada (profil versi lama)', () => {
    expect(readAcceptsFlows(ATURAN_KANONIK)).toEqual(['organik']);
    expect(acceptsMinyakOf(ATURAN_KANONIK)).toBe(false);
  });

  it('mengizinkan minyak hanya bila dinyatakan eksplisit', () => {
    const duaAliran = { ...ATURAN_KANONIK, acceptsFlows: ['organik', 'minyak'] };
    expect(acceptsMinyakOf(duaAliran)).toBe(true);
    const minyakSaja = { ...ATURAN_KANONIK, acceptsFlows: ['minyak'] };
    expect(readAcceptsFlows(minyakSaja)).toEqual(['minyak']);
    const rusak = { ...ATURAN_KANONIK, acceptsFlows: 'minyak' };
    expect(readAcceptsFlows(rusak)).toEqual([]);
    expect(acceptsMinyakOf(rusak)).toBe(false);
  });
});