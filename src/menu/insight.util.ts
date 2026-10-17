import type { MenuComponent } from '../common/constant/domain.constant.js';

export const INSIGHT_SAMPLE_MIN = 30;

export const INSIGHT_METHOD_LINEAR = 'linear_0_4';

export type InsightConfidence = 'rendah' | 'cukup';

export interface InsightInputRow {
  readonly menuItemId: string;
  readonly nama: string;
  readonly komponen: MenuComponent;
  readonly biayaRp: number | null;
  readonly avgTingkatSisa: number;
  readonly n: number;
  readonly hari: number;
  readonly totalPorsiDinilai: number;
  readonly porsiTerbuangSetara: number;
}

export interface MenuInsightItem {
  readonly menuItemId: string;
  readonly nama: string;
  readonly komponen: MenuComponent;
  readonly biayaRp: number | null;
  readonly avgTingkatSisa: number;
  readonly n: number;
  readonly hari: number;
  readonly totalPorsiDinilai: number;
  readonly estimasiNilaiTerbuangRpPerHari: number | null;
  readonly confidence: InsightConfidence;
  readonly catatan: string | null;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

const roundToRupiah = (value: number): number => Math.round(value);

const toInsightItem = (row: InsightInputRow): MenuInsightItem => {
  const countable = row.hari > 0 && row.n > 0;
  const estimasi =
    countable && row.biayaRp !== null
      ? roundToRupiah((row.biayaRp * row.porsiTerbuangSetara) / row.hari)
      : null;

  const confidence: InsightConfidence =
    row.n >= INSIGHT_SAMPLE_MIN ? 'cukup' : 'rendah';
  const catatan =
    row.biayaRp === null
      ? 'biaya item belum diisi sehingga estimasi nilai belum tersedia'
      : confidence === 'rendah'
        ? `n kecil; butuh minimal ${INSIGHT_SAMPLE_MIN} penilaian`
        : null;

  return Object.freeze({
    menuItemId: row.menuItemId,
    nama: row.nama,
    komponen: row.komponen,
    biayaRp: row.biayaRp,
    avgTingkatSisa: round2(row.avgTingkatSisa),
    n: row.n,
    hari: row.hari,
    totalPorsiDinilai: row.totalPorsiDinilai,
    estimasiNilaiTerbuangRpPerHari: estimasi,
    confidence,
    catatan,
  });
};

const compareInsights = (
  left: MenuInsightItem,
  right: MenuInsightItem,
): number => {
  if (left.avgTingkatSisa !== right.avgTingkatSisa)
    return right.avgTingkatSisa - left.avgTingkatSisa;
  if (left.n !== right.n) return right.n - left.n;
  return left.nama < right.nama ? -1 : 1;
};

export const buildMenuInsights = (
  rows: readonly InsightInputRow[],
): readonly MenuInsightItem[] =>
  Object.freeze([...rows].map(toInsightItem).sort(compareInsights));