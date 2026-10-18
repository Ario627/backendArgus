import { describe, expect, it } from '@jest/globals';
import type { ParameterReading } from '../parameter/parameter.service.js';
import {
  resolveCostModel,
  travelCostPerSecondFrom,
} from './optimizer-cost.util.js';

const reading = (
  nilai: number | null,
  sumber: ParameterReading['sumber'] = 'kalibrasi_pilot',
): ParameterReading => ({ nilai, sumber });

describe('travelCostPerSecondFrom', () => {
  it('mengubah rupiah per km menjadi rupiah per detik', () => {
    expect(travelCostPerSecondFrom(3000, 20)).toBeCloseTo(16.67, 2);
    expect(travelCostPerSecondFrom(3600, 36)).toBeCloseTo(36, 6);
  });

  it('menolak kecepatan atau harga tidak masuk akal', () => {
    expect(travelCostPerSecondFrom(3000, 0)).toBeNull();
    expect(travelCostPerSecondFrom(3000, -5)).toBeNull();
    expect(travelCostPerSecondFrom(0, 20)).toBeNull();
    expect(travelCostPerSecondFrom(Number.POSITIVE_INFINITY, 20)).toBeNull();
  });
});

describe('resolveCostModel', () => {
  it('uncalibrated bila biaya_per_km belum ada', () => {
    const model = resolveCostModel(null, reading(5000), 20);
    expect(model.source).toBe('uncalibrated');
    expect(model.travelCostPerSecond).toBeNull();
    expect(model.latePenaltyPerKgMinute).toBeNull();
  });

  it('uncalibrated bila biaya_per_km NULL eksplisit', () => {
    const model = resolveCostModel(reading(null, 'belum_ada'), null, 20);
    expect(model.source).toBe('uncalibrated');
  });

  it('memakai penalti umur bila keduanya terkalibrasi', () => {
    const model = resolveCostModel(reading(3000), reading(6000), 20);
    expect(model.source).toBe('parameter:biaya_per_km+penalti_umur_per_jam');
    expect(model.travelCostPerSecond).not.toBeNull();
    expect(model.latePenaltyPerKgMinute).toBe(100);
  });

  it('penalti nol tetap dianggap terkalibrasi', () => {
    const model = resolveCostModel(reading(3000), reading(0), 20);
    expect(model.source).toBe('parameter:biaya_per_km+penalti_umur_per_jam');
    expect(model.latePenaltyPerKgMinute).toBe(0);
  });

  it('hanya biaya_per_km bila penalti belum ada', () => {
    const model = resolveCostModel(reading(3000), null, 20);
    expect(model.source).toBe('parameter:biaya_per_km');
    expect(model.latePenaltyPerKgMinute).toBe(0);
  });

  it('menolak penalti negatif', () => {
    const model = resolveCostModel(reading(3000), reading(-10), 20);
    expect(model.source).toBe('parameter:biaya_per_km');
    expect(model.latePenaltyPerKgMinute).toBe(0);
  });
});
