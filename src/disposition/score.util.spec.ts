import type { GateProfile } from '../batch/gate.service.js';
import type { FractionCode, MoistureProxy } from '../common/constant/domain.constant.js';
import {
  hitungSkorDisposisi,
  type ScoreBatch,
  type ScoreCandidate,
  type ScoreParameters,
} from './score.util.js';
import { describe, expect, it } from '@jest/globals';


const buildProfile = (overrides: Partial<GateProfile> = {}): GateProfile => ({
  acceptsFractions: null,
  moisture: { passMin: 45, passMax: 75, fixAbove: 75, rejectAbove: 80 },
  maxAgeHours: null,
  contaminant: { plasticPercentMax: null, visibleOil: null },
  capacityKgPerDay: null,
  operatingHours: null,
  pricePerKg: null,
  ...overrides,
});

const BATCH: ScoreBatch = {
  aliran: 'organik',
  weightKg: 100,
  ageHours: 2,
  fractions: { A: 100 } as Partial<Record<FractionCode, number>>,
  moistureProxy: 'sedang' as MoistureProxy,
  visibleOil: false,
};

const PARAMS: ScoreParameters = {
  biayaPerKm: 5000,
  faktorMuat: 800,
  biayaTolak: 100000,
  penaltiUmurPerJam: 2500,
  kecepatanKotaKmJam: 20,
  assumedSpeed: false,
};

const candidate = (
  overrides: Partial<ScoreCandidate> & Pick<ScoreCandidate, 'facilityId' | 'tier' | 'distanceKm'>,
): ScoreCandidate => ({
  nama: overrides.facilityId,
  profile: buildProfile(),
  acceptsMinyak: false,
  queueKgToday: 0,
  ...overrides,
});

describe('hitungSkorDisposisi', () => {
  it('memilih kandidat dengan skor terendah dan mengisi rincian lengkap', () => {
    const dekat = candidate({ facilityId: 'f-dekat', tier: 'T1', distanceKm: 2 });
    const jauh = candidate({ facilityId: 'f-jauh', tier: 'T2', distanceKm: 10 });
    const decision = hitungSkorDisposisi(BATCH, [dekat, jauh], PARAMS);

    expect(decision.reason).toBe('SKOR_TERENDAH');
    expect(decision.chosenTier).toBe('T1');
    expect(decision.chosenFacilityId).toBe('f-dekat');
    expect(decision.assumedSpeed).toBe(false);
    expect(decision.candidates).toHaveLength(2);

    const pilihan = decision.candidates.find((entry) => entry.facilityId === 'f-dekat');
    expect(pilihan?.score).toBe(5262.5);
    expect(pilihan?.breakdown).toEqual({ cost: 12.5, value: 0, risk: 5250 });
  });

  it('nilai produk dapat membalik keputusan menuju kandidat yang lebih jauh', () => {
    const dekat = candidate({ facilityId: 'f-dekat', tier: 'T1', distanceKm: 2 });
    const jauhBernilai = candidate({
      facilityId: 'f-nilai',
      tier: 'T2',
      distanceKm: 10,
      profile: buildProfile({ pricePerKg: 20 }),
    });
    const decision = hitungSkorDisposisi(BATCH, [dekat, jauhBernilai], PARAMS);
    expect(decision.chosenFacilityId).toBe('f-nilai');
    const pilihan = decision.candidates.find((entry) => entry.facilityId === 'f-nilai');
    expect(pilihan?.score).toBe(4312.5);
    expect(pilihan?.breakdown?.value).toBe(2000);
  });

  it('menggugurkan kandidat yang melewati batas umur saat tiba', () => {
    const cepat = candidate({ facilityId: 'f-cepat', tier: 'T1', distanceKm: 12 });
    const lambat = candidate({
      facilityId: 'f-lambat',
      tier: 'T2',
      distanceKm: 30,
      profile: buildProfile({ maxAgeHours: 3 }),
    });
    const decision = hitungSkorDisposisi(BATCH, [cepat, lambat], PARAMS);

    const gugur = decision.candidates.find((entry) => entry.facilityId === 'f-lambat');
    expect(gugur?.eligible).toBe(false);
    expect(gugur?.reason).toBe('MELEWATI_BATAS_UMUR');
    expect(gugur?.detail).toEqual({ arrivalAgeHours: 3.5, maxAgeHours: 3 });
    expect(decision.chosenFacilityId).toBe('f-cepat');
  });

  it('menggugurkan kandidat yang menolak lewat gate', () => {
    const penolak = candidate({
      facilityId: 'f-penolak',
      tier: 'T2',
      distanceKm: 5,
      profile: buildProfile({ contaminant: { plasticPercentMax: null, visibleOil: 'reject' } }),
    });
    const decision = hitungSkorDisposisi({ ...BATCH, visibleOil: true }, [penolak], PARAMS);

    expect(decision.candidates[0]?.eligible).toBe(false);
    expect(decision.candidates[0]?.reason).toBe('GATE_TOLAK');
    expect(decision.reason).toBe('NO_ELIGIBLE_CANDIDATE');
    expect(decision.chosenTier).toBe('T4');
    expect(decision.chosenFacilityId).toBeNull();
  });

  it('menggugurkan kandidat yang kapasitas hariannya sudah penuh', () => {
    const penuh = candidate({
      facilityId: 'f-penuh',
      tier: 'T2',
      distanceKm: 5,
      queueKgToday: 80,
      profile: buildProfile({ capacityKgPerDay: 100 }),
    });
    const decision = hitungSkorDisposisi({ ...BATCH, weightKg: 25 }, [penuh], PARAMS);
    expect(decision.candidates[0]?.reason).toBe('KAPASITAS_PENUH');
    expect(decision.chosenTier).toBe('T4');
  });

  it('jatuh ke T4 tanpa menghitung skor ketika parameter belum terkalibrasi', () => {
    const kandidat = candidate({ facilityId: 'f-1', tier: 'T1', distanceKm: 5 });
    const decision = hitungSkorDisposisi(BATCH, [kandidat], null);

    expect(decision.reason).toBe('PARAMETER_BELUM_TERKALIBRASI');
    expect(decision.chosenTier).toBe('T4');
    expect(decision.chosenFacilityId).toBeNull();
    expect(decision.assumedSpeed).toBe(true);
    expect(decision.candidates[0]?.eligible).toBe(true);
    expect(decision.candidates[0]?.score).toBeUndefined();
    expect(decision.candidates[0]?.notes).toContain('PARAMETER_BELUM_TERKALIBRASI');
  });

  it('menghasilkan T4 tanpa kandidat sama sekali', () => {
    const decision = hitungSkorDisposisi(BATCH, [], PARAMS);
    expect(decision.reason).toBe('NO_ELIGIBLE_CANDIDATE');
    expect(decision.chosenTier).toBe('T4');
    expect(decision.chosenFacilityId).toBeNull();
    expect(decision.candidates).toEqual([]);
  });

  it('memilih tier lebih rendah saat skor seri, lalu id fasilitas secara leksikografis', () => {
    const t1 = candidate({ facilityId: 'f-b', tier: 'T1', distanceKm: 8 });
    const t2 = candidate({ facilityId: 'f-a', tier: 'T2', distanceKm: 8 });
    const seri = hitungSkorDisposisi(BATCH, [t2, t1], PARAMS);
    expect(seri.chosenFacilityId).toBe('f-b');

    const a = candidate({ facilityId: 'f-a', tier: 'T1', distanceKm: 8 });
    const b = candidate({ facilityId: 'f-b', tier: 'T1', distanceKm: 8 });
    const leksik = hitungSkorDisposisi(BATCH, [b, a], PARAMS);
    expect(leksik.chosenFacilityId).toBe('f-a');
  });

  it('menambahkan catatan asumsi pTolak untuk gate yang berisiko', () => {
    const perbaiki = candidate({
      facilityId: 'f-perbaiki',
      tier: 'T1',
      distanceKm: 5,
      profile: buildProfile({ contaminant: { plasticPercentMax: null, visibleOil: 'fix' } }),
    });
    const decision = hitungSkorDisposisi({ ...BATCH, visibleOil: true }, [perbaiki], PARAMS);
    expect(decision.candidates[0]?.notes).toContain('P_TOLAK_ASUMSI');
  });

  it('memakai lintasan yang sama dari input yang sama (deterministik)', () => {
    const kandidat = [
      candidate({ facilityId: 'f-1', tier: 'T1', distanceKm: 3 }),
      candidate({ facilityId: 'f-2', tier: 'T2', distanceKm: 7 }),
    ];
    const satu = hitungSkorDisposisi(BATCH, kandidat, PARAMS);
    const dua = hitungSkorDisposisi(BATCH, kandidat, PARAMS);
    expect(JSON.stringify(satu)).toBe(JSON.stringify(dua));
  });

  it('menolak faktor muat nol atau negatif', () => {
    expect(() =>
      hitungSkorDisposisi(BATCH, [], { ...PARAMS, faktorMuat: 0 }),
    ).toThrow(RangeError);
  });
});