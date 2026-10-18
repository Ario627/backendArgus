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
    expect(parsed?.unassigned).toEqual([
      { batchId: 'batch-3', reason: 'OPTIMIZER' },
    ]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed?.routes)).toBe(true);
    expect(Object.isFrozen(parsed?.routes[0]?.sequence)).toBe(true);
    expect(Object.isFrozen(parsed?.unassigned[0])).toBe(true);
  });

  it('menerima entri unassigned berstruktur dengan alasan yang sah', () => {
    const structured = validResponse();
    structured.unassigned = [
      { batchId: 'batch-3', reason: 'KAPASITAS' },
      { batchId: 'batch-4', reason: 'BATAS_WAKTU' },
      { batchId: 'batch-5', reason: 'TIDAK_TERJADWAL' },
    ] as unknown as string[];
    const parsed = parseOptimizerResponse(
      structured as unknown as Record<string, unknown>,
    );
    expect(parsed?.unassigned).toEqual([
      { batchId: 'batch-3', reason: 'KAPASITAS' },
      { batchId: 'batch-4', reason: 'BATAS_WAKTU' },
      { batchId: 'batch-5', reason: 'TIDAK_TERJADWAL' },
    ]);
  });

  it('menormalkan alasan tak dikenal menjadi TIDAK_TERJADWAL', () => {
    const odd = validResponse();
    odd.unassigned = [
      { batchId: 'batch-3', reason: 'ALASAN_BARU' },
    ] as unknown as string[];
    const parsed = parseOptimizerResponse(
      odd as unknown as Record<string, unknown>,
    );
    expect(parsed?.unassigned[0]).toEqual({
      batchId: 'batch-3',
      reason: 'TIDAK_TERJADWAL',
    });
  });

  it('menolak entri unassigned tanpa batchId yang sah', () => {
    const broken = validResponse();
    broken.unassigned = [{ reason: 'KAPASITAS' }] as unknown as string[];
    expect(
      parseOptimizerResponse(broken as unknown as Record<string, unknown>),
    ).toBeNull();
    const empty = validResponse();
    empty.unassigned = [
      { batchId: '', reason: 'KAPASITAS' },
    ] as unknown as string[];
    expect(
      parseOptimizerResponse(empty as unknown as Record<string, unknown>),
    ).toBeNull();
  });

  it('meneruskan strategy saat dikirim solver', () => {
    const withStrategy = validResponse();
    withStrategy.solverStats = {
      objective: 123456,
      timeSeconds: 4.2,
      strategy: 'descent',
    };
    const parsed = parseOptimizerResponse(withStrategy);
    expect(parsed?.solverStats.strategy).toBe('descent');
    const warm = validResponse();
    warm.solverStats = {
      objective: 123456,
      timeSeconds: 4.2,
      strategy: 'warm',
    };
    expect(parseOptimizerResponse(warm)?.solverStats.strategy).toBe('warm');
    const withoutStrategy = parseOptimizerResponse(validResponse());
    expect(withoutStrategy?.solverStats.strategy).toBeUndefined();
  });

  it('membuang strategy yang tidak dikenal tanpa menolak respons', () => {
    const odd = validResponse();
    odd.solverStats = {
      objective: 123456,
      timeSeconds: 4.2,
      strategy: 'kuantum',
    };
    const parsed = parseOptimizerResponse(odd);
    expect(parsed).not.toBeNull();
    expect(parsed?.solverStats.strategy).toBeUndefined();
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
