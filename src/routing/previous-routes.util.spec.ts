import { describe, expect, it } from '@jest/globals';
import { groupPreviousRoutes } from './previous-routes.util.js';

describe('groupPreviousRoutes', () => {
  it('mengelompokkan baris menjadi urutan per armada', () => {
    const routes = groupPreviousRoutes([
      { fleetId: 'fleet-1', batchId: 'b1' },
      { fleetId: 'fleet-1', batchId: 'b2' },
      { fleetId: 'fleet-2', batchId: 'b3' },
      { fleetId: 'fleet-1', batchId: 'b4' },
    ]);
    expect(routes).toEqual([
      { fleetId: 'fleet-1', sequence: ['b1', 'b2', 'b4'] },
      { fleetId: 'fleet-2', sequence: ['b3'] },
    ]);
  });

  it('membekukan hasil agar tidak bisa diubah pemanggil', () => {
    const routes = groupPreviousRoutes([{ fleetId: 'fleet-1', batchId: 'b1' }]);
    expect(Object.isFrozen(routes)).toBe(true);
    expect(Object.isFrozen(routes[0])).toBe(true);
    expect(Object.isFrozen(routes[0]?.sequence)).toBe(true);
  });

  it('mengembalikan daftar kosong tanpa baris', () => {
    expect(groupPreviousRoutes([])).toEqual([]);
  });

  it('membatasi jumlah rute agar payload tetap terkendali', () => {
    const rows = Array.from({ length: 80 }, (_value, index) => ({
      fleetId: `fleet-${index}`,
      batchId: `b${index}`,
    }));
    const routes = groupPreviousRoutes(rows);
    expect(routes).toHaveLength(64);
    expect(routes[63]?.fleetId).toBe('fleet-63');
  });

  it('membatasi panjang urutan per rute', () => {
    const rows = Array.from({ length: 620 }, (_value, index) => ({
      fleetId: 'fleet-1',
      batchId: `b${index}`,
    }));
    const routes = groupPreviousRoutes(rows);
    expect(routes[0]?.sequence).toHaveLength(500);
    expect(routes[0]?.sequence[499]).toBe('b499');
  });

  it('mempertahankan urutan kedatangan baris per armada', () => {
    const routes = groupPreviousRoutes([
      { fleetId: 'fleet-2', batchId: 'b9' },
      { fleetId: 'fleet-1', batchId: 'b1' },
      { fleetId: 'fleet-2', batchId: 'b8' },
    ]);
    expect(routes).toEqual([
      { fleetId: 'fleet-2', sequence: ['b9', 'b8'] },
      { fleetId: 'fleet-1', sequence: ['b1'] },
    ]);
  });
});