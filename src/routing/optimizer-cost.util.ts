import type { ParameterReading } from '../parameter/parameter.service.js';

const SECONDS_PER_HOUR = 3600;
const MINUTES_PER_HOUR = 60;

export interface OptimizerCostModel {
  readonly travelCostPerSecond: number | null;
  readonly latePenaltyPerKgMinute: number | null;
  readonly source: string;
}

const positiveValue = (reading: ParameterReading | null): number | null => {
  if (reading === null || reading.nilai === null) return null;
  return reading.nilai > 0 ? reading.nilai : null;
};

const nonNegativeValue = (reading: ParameterReading | null): number | null => {
  if (reading === null || reading.nilai === null) return null;
  return reading.nilai >= 0 ? reading.nilai : null;
};

export const travelCostPerSecondFrom = (
  costPerKm: number,
  speedKmh: number,
): number | null => {
  if (speedKmh <= 0 || costPerKm <= 0) return null;
  const value = (costPerKm * speedKmh) / SECONDS_PER_HOUR;
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const resolveCostModel = (
  costPerKm: ParameterReading | null,
  latePenaltyPerHour: ParameterReading | null,
  speedKmh: number,
): OptimizerCostModel => {
  const price = positiveValue(costPerKm);
  const travel =
    price === null ? null : travelCostPerSecondFrom(price, speedKmh);
  if (travel === null) {
    return Object.freeze({
      travelCostPerSecond: null,
      latePenaltyPerKgMinute: null,
      source: 'uncalibrated',
    });
  }
  const late = nonNegativeValue(latePenaltyPerHour);
  return Object.freeze({
    travelCostPerSecond: travel,
    latePenaltyPerKgMinute: late === null ? 0 : late / MINUTES_PER_HOUR,
    source:
      late === null
        ? 'parameter:biaya_per_km'
        : 'parameter:biaya_per_km+penalti_umur_per_jam',
  });
};
