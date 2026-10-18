import { describe, expect, it } from '@jest/globals';
import {
  PDF_BATCH_COLUMNS,
  PDF_TABLE_WIDTH,
  paginateRows,
  rowsPerPage,
} from './pdf-batches.layout.js';
import { formatKg, toWinAnsiSafe, truncateToWidth } from './pdf-text.util.js';

const PAGE_CONTENT_WIDTH = 595.28 - 80;

const monospace =
  (size: number) =>
  (text: string): number =>
    Array.from(text).length * size * 0.5;

describe('toWinAnsiSafe', () => {
  it('mempertahankan huruf latin, tanda baca, dan em dash', () => {
    expect(toWinAnsiSafe('SPPG Cibiru — minyak jelantah')).toBe(
      'SPPG Cibiru — minyak jelantah',
    );
  });

  it('mengganti karakter di luar cakupan font standar', () => {
    expect(toWinAnsiSafe('batch 🍚 三')).toBe('batch ? ?');
  });
});

describe('truncateToWidth', () => {
  const measure = monospace(7.5);

  it('mengembalikan teks apa adanya bila muat', () => {
    expect(truncateToWidth('SPPG', 100, measure)).toBe('SPPG');
  });

  it('memotong dan menambahkan elipsis saat melebihi lebar', () => {
    const hasil = truncateToWidth('SPPG Cibiru Raya Sekali', 40, measure);
    expect(hasil.endsWith('…')).toBe(true);
    expect(measure(hasil)).toBeLessThanOrEqual(40);
  });

  it('mengembalikan string kosong bila tidak ada ruang tersisa', () => {
    expect(truncateToWidth('SPPG', 2, measure)).toBe('');
  });
});

describe('formatKg', () => {
  it('membulatkan dua desimal dan menandai nilai kosong', () => {
    expect(formatKg('12.345')).toBe('12.35');
    expect(formatKg(7)).toBe('7.00');
    expect(formatKg(null)).toBe('-');
    expect(formatKg('bukan-angka')).toBe('-');
  });
});

describe('PDF_BATCH_COLUMNS', () => {
  it('memenuhi lebar tabel tanpa melewati area konten', () => {
    expect(PDF_TABLE_WIDTH).toBeLessThanOrEqual(PAGE_CONTENT_WIDTH);
    expect(new Set(PDF_BATCH_COLUMNS.map((column) => column.key)).size).toBe(
      PDF_BATCH_COLUMNS.length,
    );
  });
});

describe('rowsPerPage', () => {
  it('membatasi jumlah baris per halaman berdasarkan tinggi konten', () => {
    expect(rowsPerPage({ contentHeight: 130, rowHeight: 13 })).toBe(10);
    expect(rowsPerPage({ contentHeight: 1, rowHeight: 13 })).toBe(1);
  });
});

describe('paginateRows', () => {
  it('membagi baris ke halaman berurutan tanpa kehilangan data', () => {
    const rows = Array.from({ length: 7 }, (_, index) => index);
    const pages = paginateRows(rows, 3);
    expect(pages.map((page) => page.length)).toEqual([3, 3, 1]);
    expect(pages.flat()).toEqual(rows);
    expect(Object.isFrozen(pages)).toBe(true);
  });

  it('mengembalikan daftar kosong untuk data kosong', () => {
    expect(paginateRows([], 5)).toEqual([]);
  });
});