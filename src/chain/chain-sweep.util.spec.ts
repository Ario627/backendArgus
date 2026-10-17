import { describe, expect, it } from '@jest/globals';
import { resolveSweepPlan, SWEEP_MAX_BATCHES } from './chain-sweep.util.js';

describe('resolveSweepPlan', () => {
  it('memakai jumlah batch harian apa adanya selama di bawah batas', () => {
    expect(resolveSweepPlan({ dailyBatches: 100 })).toEqual({
      newest: 100,
      sampleCapacity: 400,
    });
  });

  it('memotong jumlah terbaru ke batas satu kali jalan', () => {
    const plan = resolveSweepPlan({ dailyBatches: 900 });
    expect(plan.newest).toBe(SWEEP_MAX_BATCHES);
    expect(plan.sampleCapacity).toBe(0);
  });

  it('menyisakan kapasitas sampel dari sisa batas', () => {
    expect(resolveSweepPlan({ dailyBatches: 300, maxBatches: 350 })).toEqual({
      newest: 300,
      sampleCapacity: 50,
    });
  });

  it('tidak pernah menghasilkan nilai terbaru di bawah satu', () => {
    expect(resolveSweepPlan({ dailyBatches: 0 }).newest).toBe(1);
    expect(resolveSweepPlan({ dailyBatches: -3, maxBatches: 0 })).toEqual({
      newest: 1,
      sampleCapacity: 0,
    });
  });
});