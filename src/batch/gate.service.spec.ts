import type { FractionCode, MoistureProxy, WasteFlow } from '../common/constant/domain.constant.js';
import type { MoistureRules, VisibleOilPolicy } from '../facility/acceptance-profile.types.js';
import { DEFAULT_SAFE_PROFILE, evaluateGate, type GateInput, type GateProfile, type GateTarget } from './gate.service.js';
import { describe, expect, it } from '@jest/globals';

const MOISTURE: MoistureRules = { passMin: 45, passMax: 75, fixAbove: 75, rejectAbove: 80 };

const buildProfile = (overrides: Partial<GateProfile> = {}): GateProfile => ({
  acceptsFractions: null,
  moisture: MOISTURE,
  maxAgeHours: null,
  contaminant: { plasticPercentMax: null, visibleOil: null },
  capacityKgPerDay: null,
  operatingHours: null,
  pricePerKg: null,
  ...overrides,
});

const buildInput = (overrides: Partial<GateInput> = {}): GateInput => ({
  aliran: 'organik' as WasteFlow,
  weightKg: 12.4,
  fractions: { A: 40, B: 45, C: 10, E: 5 } as Partial<Record<FractionCode, number>>,
  moistureProxy: 'sedang' as MoistureProxy,
  visibleOil: false,
  ageHours: 2,
  queueKgToday: 0,
  profile: buildProfile(),
  target: null,
  ...overrides,
});

const rulesOf = (input: GateInput): readonly string[] =>
  evaluateGate(input).violations.map((violation) => violation.rule);

describe('evaluateGate', () => {
  it('lolos untuk batch bersih tanpa aturan yang menyentuh', () => {
    const result = evaluateGate(buildInput());
    expect(result.status).toBe('LOLOS');
    expect(result.violations).toEqual([]);
    expect(result.fixes).toEqual([]);
    expect(result.usedDefaultProfile).toBe(false);
  });

  it('menandai usedDefaultProfile hanya untuk profil bawaan', () => {
    expect(evaluateGate(buildInput({ profile: DEFAULT_SAFE_PROFILE })).usedDefaultProfile).toBe(true);
    expect(evaluateGate(buildInput()).usedDefaultProfile).toBe(false);
  });

  it('menolak batch yang melewati batas umur, dan hanya jika benar-benar lewat', () => {
    const profile = buildProfile({ maxAgeHours: 12 });
    expect(rulesOf(buildInput({ profile, ageHours: 12 }))).toEqual([]);
    expect(rulesOf(buildInput({ profile, ageHours: 12.01 }))).toEqual(['UMUR_LEWAT']);
    expect(evaluateGate(buildInput({ profile, ageHours: 30 })).status).toBe('TOLAK');
  });

  it('meminta tiriskan untuk proksi basah dan mencatat proksi kering sebagai catatan', () => {
    const basah = evaluateGate(buildInput({ moistureProxy: 'basah' }));
    expect(basah.status).toBe('PERBAIKI');
    expect(basah.fixes).toEqual(['tiriskan']);
    expect(basah.violations[0]?.rule).toBe('MOISTURE_BASAH');

    const kering = evaluateGate(buildInput({ moistureProxy: 'kering' }));
    expect(kering.status).toBe('LOLOS');
    expect(kering.violations).toEqual([]);
    expect(kering.notes[0]?.rule).toBe('MOISTURE_KERING');

    const keringMinyak = evaluateGate(buildInput({ moistureProxy: 'kering', aliran: 'minyak', fractions: {} }));
    expect(keringMinyak.notes).toEqual([]);
  });

  it('menerapkan kebijakan minyak terlihat: fix, reject, allow', () => {
    const withPolicy = (visibleOil: VisibleOilPolicy): GateProfile =>
      buildProfile({ contaminant: { plasticPercentMax: null, visibleOil } });

    expect(rulesOf(buildInput({ visibleOil: false, profile: withPolicy('reject') }))).toEqual([]);
    expect(evaluateGate(buildInput({ visibleOil: true, profile: withPolicy('allow') })).status).toBe('LOLOS');
    const fix = evaluateGate(buildInput({ visibleOil: true, profile: withPolicy('fix') }));
    expect(fix.status).toBe('PERBAIKI');
    expect(fix.fixes).toEqual(['pisahkan minyak ke jerigen']);
    expect(rulesOf(buildInput({ visibleOil: true, profile: withPolicy('reject') }))).toEqual(['MINYAK_TERLIHAT']);
    expect(evaluateGate(buildInput({ visibleOil: true, profile: withPolicy('reject') })).status).toBe('TOLAK');
  });

  it('menandai kontaminan hanya saat melewati batas, bukan saat sama', () => {
    const profile = buildProfile({ contaminant: { plasticPercentMax: 5, visibleOil: null } });
    expect(rulesOf(buildInput({ profile, fractions: { A: 95, E: 5 } }))).toEqual([]);
    expect(rulesOf(buildInput({ profile, fractions: { A: 94, E: 6 } }))).toEqual(['KONTAMINAN_E_MELEBIHI']);
    expect(evaluateGate(buildInput({ profile, fractions: { A: 94, E: 6 } })).status).toBe('PERBAIKI');
  });

  it('mengalihkan bila komposisi berisi fraksi yang tidak diterima', () => {
    const profile = buildProfile({ acceptsFractions: ['A', 'B', 'C'] });
    expect(rulesOf(buildInput({ profile, fractions: { A: 40, B: 45, C: 15 } }))).toEqual([]);
    const result = evaluateGate(buildInput({ profile, fractions: { A: 50, D: 50 } }));
    expect(result.status).toBe('ALIHKAN');
    expect(result.violations[0]?.detail).toContain('D');
  });

  it('mengalihkan bila antrean plus batch melewati kapasitas harian', () => {
    const profile = buildProfile({ capacityKgPerDay: 100 });
    expect(rulesOf(buildInput({ profile, queueKgToday: 80, weightKg: 20 }))).toEqual([]);
    expect(rulesOf(buildInput({ profile, queueKgToday: 80, weightKg: 20.01 }))).toEqual(['KAPASITAS_HARIAN_PENUH']);
  });

  it('mengalihkan minyak ke fasilitas yang tidak menerima minyak, dan melewati bila tujuan belum ada', () => {
    const minyakInput = buildInput({ aliran: 'minyak', fractions: {} });
    expect(rulesOf(minyakInput)).toEqual([]);
    const targetMenolak: GateTarget = { facilityId: 'f-1', acceptsMinyak: false };
    expect(rulesOf({ ...minyakInput, target: targetMenolak })).toEqual(['ALIRAN_MINYAK_TIDAK_DIDUKUNG']);
    const targetMenerima: GateTarget = { facilityId: 'f-2', acceptsMinyak: true };
    expect(rulesOf({ ...minyakInput, target: targetMenerima })).toEqual([]);
  });

  it('menyimpan semua pelanggaran tetapi status mengikuti yang terberat', () => {
    const input = buildInput({
      moistureProxy: 'basah',
      visibleOil: true,
      fractions: { A: 50, D: 50 },
      profile: buildProfile({
        acceptsFractions: ['A'],
        contaminant: { plasticPercentMax: null, visibleOil: 'fix' },
      }),
    });
    const result = evaluateGate(input);
    expect(result.violations.map((violation) => violation.rule).sort()).toEqual([
      'FRAKSI_TIDAK_DITERIMA',
      'MINYAK_TERLIHAT',
      'MOISTURE_BASAH',
    ]);
    expect(result.status).toBe('ALIHKAN');
    expect(result.fixes).toEqual(['tiriskan', 'pisahkan minyak ke jerigen']);
  });

  it('TOLAK mengalahkan seluruh status lain', () => {
    const result = evaluateGate(
      buildInput({
        moistureProxy: 'basah',
        profile: buildProfile({
          maxAgeHours: 1,
          contaminant: { plasticPercentMax: null, visibleOil: 'reject' },
        }),
        visibleOil: true,
        ageHours: 5,
      }),
    );
    expect(result.status).toBe('TOLAK');
    expect(result.violations).toHaveLength(3);
  });

  it('profil dengan seluruh atribut null tidak pernah memblokir', () => {
    const kosong = buildProfile({
      contaminant: { plasticPercentMax: null, visibleOil: null },
    });
    const result = evaluateGate(
      buildInput({
        profile: kosong,
        moistureProxy: 'kering',
        fractions: { E: 100 },
        ageHours: 999,
        queueKgToday: 999,
      }),
    );
    expect(result.status).toBe('LOLOS');
    expect(result.notes).toHaveLength(1);
  });
});