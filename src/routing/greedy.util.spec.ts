import { describe, expect, it } from '@jest/globals';
import { planGreedy, type GreedyInput } from './greedy.util.js';

const baseInput = (overrides: Partial<GreedyInput> = {}): GreedyInput => ({
  stops: [
    { batchId: 'b1', kg: 10, deadlineMs: null, nodeIndex: 1 },
    { batchId: 'b2', kg: 20, deadlineMs: null, nodeIndex: 2 },
  ],
  vehicles: [{ fleetId: 'v1', capacityKg: 100 }],
  durationsSeconds: [
    [0, 300, 600],
    [300, 0, 300],
    [600, 300, 0],
  ],
  serviceSecondsPerStop: 60,
  startEpochMs: 0,
  ...overrides,
});

describe('planGreedy', () => {
  it('mengurutkan stop terdekat lebih dulu per kendaraan', () => {
    const outcome = planGreedy(baseInput());
    expect(outcome.assignments).toHaveLength(1);
    expect(outcome.assignments[0]?.fleetId).toBe('v1');
    expect(outcome.assignments[0]?.sequence).toEqual(['b1', 'b2']);
    expect(outcome.assignments[0]?.totalKg).toBe(30);
    expect(outcome.assignments[0]?.estimatedSeconds).toBe(
      300 + 60 + 300 + 60,
    );
  });

  it('menggugurkan stop yang tidak muat kapasitas mana pun', () => {
    const outcome = planGreedy(
      baseInput({
        stops: [
          { batchId: 'kecil', kg: 10, deadlineMs: null, nodeIndex: 1 },
          { batchId: 'besar', kg: 500, deadlineMs: null, nodeIndex: 2 },
        ],
        vehicles: [{ fleetId: 'v1', capacityKg: 100 }],
      }),
    );
    expect(outcome.assignments[0]?.sequence).toEqual(['kecil']);
    expect(outcome.unassigned).toEqual([
      { batchId: 'besar', reason: 'KAPASITAS' },
    ]);
  });

  it('memecah stop antar dua kendaraan saat kapasitas pertama penuh', () => {
    const outcome = planGreedy(
      baseInput({
        stops: [
          { batchId: 'b1', kg: 60, deadlineMs: null, nodeIndex: 1 },
          { batchId: 'b2', kg: 60, deadlineMs: null, nodeIndex: 2 },
        ],
        vehicles: [
          { fleetId: 'v1', capacityKg: 100 },
          { fleetId: 'v2', capacityKg: 100 },
        ],
      }),
    );
    expect(outcome.assignments).toHaveLength(2);
    expect(outcome.unassigned).toHaveLength(0);
  });

  it('menghitung lateRiskKg saat estimasi kedatangan melewati deadline', () => {
    const outcome = planGreedy(
      baseInput({
        stops: [{ batchId: 'b1', kg: 10, deadlineMs: 1000000, nodeIndex: 1 }],
        startEpochMs: 0,
        durationsSeconds: [
          [0, 300],
          [300, 0],
        ],
      }),
    );
    expect(outcome.assignments[0]?.lateRiskKg).toBe(0);
    const late = planGreedy(
      baseInput({
        stops: [{ batchId: 'b1', kg: 10, deadlineMs: 100, nodeIndex: 1 }],
        startEpochMs: 0,
        durationsSeconds: [
          [0, 300],
          [300, 0],
        ],
      }),
    );
    expect(late.assignments[0]?.lateRiskKg).toBe(10);
  });

  it('menjaga urutan prioritas deadline dan determinisme hasil', () => {
    const input = baseInput({
      stops: [
        { batchId: 'longgar', kg: 50, deadlineMs: 5000000, nodeIndex: 1 },
        { batchId: 'mepepet', kg: 10, deadlineMs: 1000, nodeIndex: 2 },
      ],
    });
    const first = planGreedy(input);
    const second = planGreedy(input);
    expect(first.assignments[0]?.sequence).toEqual(['mepepet', 'longgar']);
    expect(first.assignments[0]?.sequence).toEqual(
      second.assignments[0]?.sequence,
    );
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.assignments[0]?.sequence)).toBe(true);
  });
});