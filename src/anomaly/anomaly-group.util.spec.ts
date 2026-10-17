import { describe, expect, it } from '@jest/globals';
import type { AnomalyReport } from '../ledger/ledger-verify.types.js';
import { groupAnomalies } from './anomaly-group.util.js';

const report = (overrides: Partial<AnomalyReport>): AnomalyReport => ({
  jenis: 'NERACA_MASSA',
  tingkat: 'PERHATIAN',
  detail: { a: 1 },
  ...overrides,
});

describe('groupAnomalies', () => {
  it('mengelompokkan per jenis dan menggabungkan detail menjadi items', () => {
    const grouped = groupAnomalies([
      report({ detail: { kind: 'SAKSI_BEDA' } }),
      report({ detail: { deltaPercent: 12.5 } }),
      report({ jenis: 'DURASI_UMUR', detail: { late: true } }),
    ]);
    expect(grouped).toHaveLength(2);
    const neraca = grouped.find((entry) => entry.jenis === 'NERACA_MASSA');
    expect(neraca?.items).toHaveLength(2);
    expect(neraca?.items[0]).toEqual({ kind: 'SAKSI_BEDA' });
    expect(
      grouped.find((entry) => entry.jenis === 'DURASI_UMUR')?.items,
    ).toHaveLength(1);
  });

  it('mengambil tingkat terberat saat satu jenis muncul beberapa kali', () => {
    const grouped = groupAnomalies([
      report({ tingkat: 'INFO' }),
      report({ tingkat: 'KRITIS' }),
      report({ tingkat: 'PERHATIAN' }),
    ]);
    expect(grouped[0]?.tingkat).toBe('KRITIS');
  });

  it('mempertahankan urutan kemunculan jenis dan membekukan hasil', () => {
    const grouped = groupAnomalies([
      report({ jenis: 'RANTAI_TIMPA' }),
      report({ jenis: 'NERACA_MASSA' }),
    ]);
    expect(grouped.map((entry) => entry.jenis)).toEqual([
      'RANTAI_TIMPA',
      'NERACA_MASSA',
    ]);
    expect(Object.isFrozen(grouped)).toBe(true);
    expect(Object.isFrozen(grouped[0]?.items)).toBe(true);
  });

  it('mengembalikan daftar kosong saat tidak ada laporan', () => {
    expect(groupAnomalies([])).toEqual([]);
  });
});