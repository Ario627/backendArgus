import type { ParameterKey, ParameterSource } from '../common/constant/domain.constant.js';
import type { ParameterReading } from '../parameter/parameter.service.js';
import { assembleScoreParameters } from './parameter.assembler.js';
import { describe, expect, it } from '@jest/globals';

const reading = (nilai: number | null, sumber: ParameterSource = 'manual_admin'): ParameterReading => ({
  nilai,
  sumber,
});

const buildReadings = (values: Partial<Record<ParameterKey, number | null>>): ReadonlyMap<ParameterKey, ParameterReading> => {
  const map = new Map<ParameterKey, ParameterReading>();
  for (const [key, value] of Object.entries(values)) {
    map.set(key as ParameterKey, reading(value ?? null));
  }
  return map;
};

const FULL = {
  biaya_per_km: 5000,
  faktor_muat: 800,
  biaya_tolak: 100000,
  penalti_umur_per_jam: 2500,
  kecepatan_kota_km_jam: 20,
} as const;

describe('assembleScoreParameters', () => {
  it('menyusun parameter lengkap saat seluruh kunci terisi', () => {
    const result = assembleScoreParameters(buildReadings(FULL));
    expect(result.missing).toEqual([]);
    expect(result.params).toEqual({
      biayaPerKm: 5000,
      faktorMuat: 800,
      biayaTolak: 100000,
      penaltiUmurPerJam: 2500,
      kecepatanKotaKmJam: 20,
      assumedSpeed: false,
    });
  });

  it('gagal jujur dengan daftar kunci hilang bila ada koefisien wajib yang null', () => {
    const result = assembleScoreParameters(
      buildReadings({ ...FULL, biaya_per_km: null, penalti_umur_per_jam: null }),
    );
    expect(result.params).toBeNull();
    expect(result.missing).toEqual(['biaya_per_km', 'penalti_umur_per_jam']);
  });

  it('memakai kecepatan default dan menandai asumsi bila kecepatan belum terisi', () => {
    const result = assembleScoreParameters(buildReadings({ ...FULL, kecepatan_kota_km_jam: null }));
    expect(result.missing).toEqual([]);
    expect(result.params?.kecepatanKotaKmJam).toBe(20);
    expect(result.params?.assumedSpeed).toBe(true);
  });

  it('menolak nilai yang tidak masuk akal sebagai parameter hilang', () => {
    expect(assembleScoreParameters(buildReadings({ ...FULL, faktor_muat: 0 })).missing).toEqual(['faktor_muat']);
    expect(assembleScoreParameters(buildReadings({ ...FULL, faktor_muat: -10 })).missing).toEqual(['faktor_muat']);
    expect(assembleScoreParameters(buildReadings({ ...FULL, biaya_per_km: -1 })).missing).toEqual(['biaya_per_km']);
    expect(assembleScoreParameters(buildReadings({})).missing).toEqual([
      'biaya_per_km',
      'faktor_muat',
      'biaya_tolak',
      'penalti_umur_per_jam',
    ]);
  });
});