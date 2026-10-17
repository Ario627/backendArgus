import type { ParameterKey } from '../common/constant/domain.constant.js';
import type { ParameterReading } from '../parameter/parameter.service.js';
import { DEFAULT_CITY_SPEED_KMH, type ScoreParameters } from './score.util.js';

const REQUIRED_PARAMETER_KEYS: readonly ParameterKey[] = Object.freeze([
  'biaya_per_km',
  'faktor_muat',
  'biaya_tolak',
  'penalti_umur_per_jam',
]);

const SPEED_PARAMETER_KEY: ParameterKey = 'kecepatan_kota_km_jam';

export interface ParameterAssembly {
  readonly params: ScoreParameters | null;
  readonly missing: readonly ParameterKey[];
}

const isNonNegative = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= 0;

const isValidFaktorMuat = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value > 0;

const readValue = (
  readings: ReadonlyMap<ParameterKey, ParameterReading>,
  key: ParameterKey,
): number | null => readings.get(key)?.nilai ?? null;

export const assembleScoreParameters = (
  readings: ReadonlyMap<ParameterKey, ParameterReading>,
): ParameterAssembly => {
  const missing: ParameterKey[] = [];
  const biayaPerKm = readValue(readings, 'biaya_per_km');
  const faktorMuat = readValue(readings, 'faktor_muat');
  const biayaTolak = readValue(readings, 'biaya_tolak');
  const penaltiUmurPerJam = readValue(readings, 'penalti_umur_per_jam');

  if (!isNonNegative(biayaPerKm)) missing.push('biaya_per_km');
  if (!isValidFaktorMuat(faktorMuat)) missing.push('faktor_muat');
  if (!isNonNegative(biayaTolak)) missing.push('biaya_tolak');
  if (!isNonNegative(penaltiUmurPerJam)) missing.push('penalti_umur_per_jam');

  if (missing.length > 0 || !isNonNegative(biayaPerKm) || !isValidFaktorMuat(faktorMuat) || !isNonNegative(biayaTolak) || !isNonNegative(penaltiUmurPerJam)) {
    return { params: null, missing: Object.freeze(missing) };
  }

  const speed = readValue(readings, SPEED_PARAMETER_KEY);
  const speedValid = isNonNegative(speed) && speed > 0;
  return {
    params: Object.freeze({
      biayaPerKm,
      faktorMuat,
      biayaTolak,
      penaltiUmurPerJam,
      kecepatanKotaKmJam: speedValid ? speed : DEFAULT_CITY_SPEED_KMH,
      assumedSpeed: !speedValid,
    }),
    missing: Object.freeze([]),
  };
};