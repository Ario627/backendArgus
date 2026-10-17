import { describe, expect, it } from '@jest/globals';
import { parseOptimizerResponse } from './optimizer-response.util.js';

const validResponse = () => ({
  status: 'OK',
  planId: null,
  routes: [
    {
      fleetId: 'fleet-1',
      sequence: ['batch-1', 'batch-2'],
      totalKg: 90,
      estimatedSeconds: 5400,
      lateRiskKg: 0,
    },
  ],
  unassigned: ['batch-3'],
  solverStats: { objective: 123456, timeSeconds: 4.2 },
});

describe('parseOptimizerResponse', () => {
  it('menerima respons sah dan membekukan hasilnya', () => {
    const parsed = parseOptimizerResponse(validResponse());
    expect(parsed).not.toBeNull();
    expect(parsed?.routes).toHaveLength(1);
    expect(parsed?.unassigned).toEqual(['batch-3']);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed?.routes)).toBe(true);
    expect(Object.isFrozen(parsed?.routes[0]?.sequence)).toBe(true);
  });

  it('menolak status tak dikenal dan bentuk bukan objek', () => {
    expect(
      parseOptimizerResponse({ ...validResponse(), status: 'MANTAP' }),
    ).toBeNull();
    expect(parseOptimizerResponse(null)).toBeNull();
    expect(parseOptimizerResponse([validResponse()])).toBeNull();
    expect(parseOptimizerResponse('ok')).toBeNull();
  });

  it('menolak angka tidak wajar (NaN, negatif, di luar batas)', () => {
    const nan = validResponse();
    (nan.routes[0] as { totalKg: number }).totalKg = Number.NaN;
    expect(parseOptimizerResponse(nan)).toBeNull();
    const negative = validResponse();
    (negative.routes[0] as { estimatedSeconds: number }).estimatedSeconds = -1;
    expect(parseOptimizerResponse(negative)).toBeNull();
    const huge = validResponse();
    (huge.routes[0] as { lateRiskKg: number }).lateRiskKg = 200000;
    expect(parseOptimizerResponse(huge)).toBeNull();
  });

  it('menolak urutan dengan entri kosong atau bukan string', () => {
    const bad = validResponse();
    (bad.routes[0] as { sequence: unknown[] }).sequence = ['batch-1', ''];
    expect(parseOptimizerResponse(bad)).toBeNull();
    (bad.routes[0] as { sequence: unknown[] }).sequence = ['batch-1', 7];
    expect(parseOptimizerResponse(bad)).toBeNull();
  });

  it('membatasi jumlah rute dan panjang urutan', () => {
    const tooManyRoutes = validResponse();
    tooManyRoutes.routes = Array.from({ length: 65 }, () => ({
      fleetId: 'fleet-x',
      sequence: [],
      totalKg: 0,
      estimatedSeconds: 0,
      lateRiskKg: 0,
    }));
    expect(parseOptimizerResponse(tooManyRoutes)).toBeNull();
    const tooLong = validResponse();
    (tooLong.routes[0] as { sequence: unknown[] }).sequence = Array.from(
      { length: 257 },
      (_value, index) => `batch-${index}`,
    );
    expect(parseOptimizerResponse(tooLong)).toBeNull();
  });
});