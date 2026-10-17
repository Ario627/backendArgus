import {
  buildMenuInsights,
  INSIGHT_SAMPLE_MIN,
  type InsightInputRow,
} from './insight.util.js';
import { describe, expect, it } from '@jest/globals';

const row = (overrides: Partial<InsightInputRow>): InsightInputRow => ({
  menuItemId: 'item-1',
  nama: 'Tumis kangkung',
  komponen: 'sayur',
  biayaRp: 5000,
  avgTingkatSisa: 2.8,
  n: 42,
  hari: 4,
  totalPorsiDinilai: 400,
  porsiTerbuangSetara: 120,
  ...overrides,
});

describe('buildMenuInsights', () => {
  it('menghitung estimasi nilai terbuang per hari dengan pembulatan rupiah utuh', () => {
    const [item] = buildMenuInsights([row({})]);
    expect(item?.estimasiNilaiTerbuangRpPerHari).toBe(150000);
    expect(item?.avgTingkatSisa).toBe(2.8);
    expect(item?.confidence).toBe('cukup');
    expect(item?.catatan).toBeNull();
  });

  it('membiarkan estimasi kosong saat biaya item belum diisi', () => {
    const [item] = buildMenuInsights([row({ biayaRp: null, n: 5 })]);
    expect(item?.biayaRp).toBeNull();
    expect(item?.estimasiNilaiTerbuangRpPerHari).toBeNull();
    expect(item?.catatan).toContain('biaya item belum diisi');
  });

  it('menandai keyakinan rendah di bawah ambang sampel dan menyebut angkanya', () => {
    expect(INSIGHT_SAMPLE_MIN).toBe(30);
    const [item] = buildMenuInsights([row({ n: 29 })]);
    expect(item?.confidence).toBe('rendah');
    expect(item?.catatan).toContain('30');
    const [tepat] = buildMenuInsights([row({ n: 30 })]);
    expect(tepat?.confidence).toBe('cukup');
  });

  it('tidak menghitung estimasi ketika hari atau jumlah penilaian nol', () => {
    const [nolHari] = buildMenuInsights([row({ hari: 0 })]);
    expect(nolHari?.estimasiNilaiTerbuangRpPerHari).toBeNull();
    const [nolN] = buildMenuInsights([row({ n: 0 })]);
    expect(nolN?.estimasiNilaiTerbuangRpPerHari).toBeNull();
  });

  it('mengurutkan berdasarkan sisa tertinggi, lalu jumlah sampel, lalu nama', () => {
    const items = buildMenuInsights([
      row({ menuItemId: 'a', nama: 'Bakso', avgTingkatSisa: 2.2, n: 40 }),
      row({ menuItemId: 'b', nama: 'Cah kangkung', avgTingkatSisa: 2.8, n: 10 }),
      row({ menuItemId: 'c', nama: 'Apel', avgTingkatSisa: 2.8, n: 40 }),
      row({ menuItemId: 'd', nama: 'Bening', avgTingkatSisa: 2.8, n: 40 }),
    ]);
    expect(items.map((item) => item.menuItemId)).toEqual(['c', 'd', 'b', 'a']);
  });

  it('membekukan hasil dan tidak mutasi masukan', () => {
    const input = [row({})];
    const items = buildMenuInsights(input);
    expect(Object.isFrozen(items)).toBe(true);
    expect(Object.isFrozen(items[0])).toBe(true);
    expect(input[0]?.n).toBe(42);
  });
});