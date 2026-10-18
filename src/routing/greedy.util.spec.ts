import { describe, expect, it } from '@jest/globals';
import { planGreedy, type GreedyInput } from './greedy.util.js';

const baseInput = (overrides: Partial<GreedyInput> = {}): GreedyInput => ({
  stops: [
    { batchId: 'b1', kg: 10, readyMs: null, deadlineMs: null, nodeIndex: 1 },
    { batchId: 'b2', kg: 20, readyMs: null, deadlineMs: null, nodeIndex: 2 },
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
    expect(outcome.assignments[0]?.estimatedSeconds).toBe(300 + 60 + 300 + 60);
  });

  it('menggugurkan stop yang tidak muat kapasitas mana pun', () => {
    const outcome = planGreedy(
      baseInput({
        stops: [
          {
            batchId: 'kecil',
            kg: 10,
            readyMs: null,
            deadlineMs: null,
            nodeIndex: 1,
          },
          {
            batchId: 'besar',
            kg: 500,
            readyMs: null,
            deadlineMs: null,
            nodeIndex: 2,
          },
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
          {
            batchId: 'b1',
            kg: 60,
            readyMs: null,
            deadlineMs: null,
            nodeIndex: 1,
          },
          {
            batchId: 'b2',
            kg: 60,
            readyMs: null,
            deadlineMs: null,
            nodeIndex: 2,
          },
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
        stops: [
          {
            batchId: 'b1',
            kg: 10,
            readyMs: null,
            deadlineMs: 1000000,
            nodeIndex: 1,
          },
        ],
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
        stops: [
          {
            batchId: 'b1',
            kg: 10,
            readyMs: null,
            deadlineMs: 100,
            nodeIndex: 1,
          },
        ],
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
        {
          batchId: 'longgar',
          kg: 50,
          readyMs: null,
          deadlineMs: 5000000,
          nodeIndex: 1,
        },
        {
          batchId: 'mepepet',
          kg: 10,
          readyMs: null,
          deadlineMs: 1000,
          nodeIndex: 2,
        },
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

  it('mempertahankan kendaraan lama untuk stop yang terkunci', () => {
    const outcome = planGreedy(
      baseInput({
        stops: [
          {
            batchId: 'b1',
            kg: 10,
            readyMs: null,
            deadlineMs: null,
            nodeIndex: 1,
          },
          {
            batchId: 'b2',
            kg: 10,
            readyMs: null,
            deadlineMs: null,
            nodeIndex: 2,
          },
        ],
        vehicles: [
          { fleetId: 'v1', capacityKg: 100 },
          { fleetId: 'v2', capacityKg: 100 },
        ],
        locks: [
          { fleetId: 'v2', sequence: ['b2'] },
          { fleetId: 'v1', sequence: ['b1'] },
        ],
      }),
    );
    const byFleet = new Map(
      outcome.assignments.map((assignment) => [
        assignment.fleetId,
        assignment.sequence,
      ]),
    );
    expect(byFleet.get('v1')).toEqual(['b1']);
    expect(byFleet.get('v2')).toEqual(['b2']);
  });

  it('mengabaikan kunci yang kendaraannya sudah tidak tersedia', () => {
    const outcome = planGreedy(
      baseInput({
        locks: [{ fleetId: 'hilang', sequence: ['b1', 'b2'] }],
      }),
    );
    expect(outcome.assignments).toHaveLength(1);
    expect(outcome.assignments[0]?.fleetId).toBe('v1');
    expect(outcome.assignments[0]?.sequence).toEqual(['b1', 'b2']);
    expect(outcome.unassigned).toHaveLength(0);
  });

  it('melepas stop dari kunci saat kapasitas kendaraannya tidak cukup', () => {
    const outcome = planGreedy(
      baseInput({
        stops: [
          {
            batchId: 'b1',
            kg: 90,
            readyMs: null,
            deadlineMs: null,
            nodeIndex: 1,
          },
          {
            batchId: 'b2',
            kg: 60,
            readyMs: null,
            deadlineMs: null,
            nodeIndex: 2,
          },
        ],
        vehicles: [
          { fleetId: 'v1', capacityKg: 100 },
          { fleetId: 'v2', capacityKg: 100 },
        ],
        locks: [{ fleetId: 'v1', sequence: ['b1', 'b2'] }],
      }),
    );
    const locked = outcome.assignments.find(
      (assignment) => assignment.fleetId === 'v1',
    );
    const moved = outcome.assignments.find(
      (assignment) => assignment.fleetId === 'v2',
    );
    expect(locked?.sequence).toEqual(['b1']);
    expect(moved?.sequence).toEqual(['b2']);
  });

  it('menghormati batas durasi rute dan memberi alasan BATAS_WAKTU', () => {
    const outcome = planGreedy(
      baseInput({
        stops: [
          {
            batchId: 'dekat',
            kg: 10,
            readyMs: null,
            deadlineMs: null,
            nodeIndex: 1,
          },
          {
            batchId: 'jauh',
            kg: 10,
            readyMs: null,
            deadlineMs: null,
            nodeIndex: 2,
          },
        ],
        maxSeconds: 500,
      }),
    );
    expect(outcome.assignments[0]?.sequence).toEqual(['dekat']);
    expect(outcome.assignments[0]?.estimatedSeconds).toBe(360);
    expect(outcome.unassigned).toEqual([
      { batchId: 'jauh', reason: 'BATAS_WAKTU' },
    ]);
  });

  it('memberi alasan TIDAK_TERJADWAL saat kendaraan penuh tanpa sebab tetap', () => {
    const outcome = planGreedy(
      baseInput({
        stops: [
          {
            batchId: 'b1',
            kg: 100,
            readyMs: null,
            deadlineMs: null,
            nodeIndex: 1,
          },
          {
            batchId: 'b2',
            kg: 100,
            readyMs: null,
            deadlineMs: null,
            nodeIndex: 2,
          },
        ],
        vehicles: [{ fleetId: 'v1', capacityKg: 100 }],
      }),
    );
    expect(outcome.assignments[0]?.sequence).toEqual(['b1']);
    expect(outcome.unassigned).toEqual([
      { batchId: 'b2', reason: 'TIDAK_TERJADWAL' },
    ]);
  });

  it('menunda keberangkatan sampai jam siap stop terpenuhi', () => {
    const outcome = planGreedy(
      baseInput({
        stops: [
          {
            batchId: 'b1',
            kg: 10,
            readyMs: 3_600_000,
            deadlineMs: null,
            nodeIndex: 1,
          },
        ],
        maxSeconds: 4000,
      }),
    );
    expect(outcome.assignments[0]?.estimatedSeconds).toBe(3600 + 60);
    expect(outcome.unassigned).toHaveLength(0);
  });

  it('menggugurkan stop yang jam siapnya di luar batas durasi rute', () => {
    const outcome = planGreedy(
      baseInput({
        stops: [
          {
            batchId: 'b1',
            kg: 10,
            readyMs: 3_600_000,
            deadlineMs: null,
            nodeIndex: 1,
          },
        ],
        maxSeconds: 3000,
      }),
    );
    expect(outcome.assignments).toHaveLength(0);
    expect(outcome.unassigned).toEqual([
      { batchId: 'b1', reason: 'BATAS_WAKTU' },
    ]);
  });
});
