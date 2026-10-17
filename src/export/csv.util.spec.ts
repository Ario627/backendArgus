import { describe, expect, it } from '@jest/globals';
import { buildCsv, csvCell, csvRow } from './csv.util.js';

describe('csvCell', () => {
  it('mengembalikan sel polos apa adanya', () => {
    expect(csvCell('SPPG Sukamaju')).toBe('SPPG Sukamaju');
    expect(csvCell(42.5)).toBe('42.5');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('menambahkan kutip ganda untuk koma, kutip, baris baru, dan titik koma', () => {
    expect(csvCell('SPPG "Kutip", Dua; Tiga')).toBe(
      '"SPPG ""Kutip"", Dua; Tiga"',
    );
    expect(csvCell('baris\nbaru')).toBe('"baris\nbaru"');
    expect(csvCell('a;b')).toBe('"a;b"');
  });

  it('menetralkan formula spreadsheet di awal sel', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+62')).toBe("'+62");
    expect(csvCell('-1+1')).toBe("'-1+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('\t=1')).toBe("'\t=1");
  });

  it('memformat Date sebagai ISO tanpa kutip karena tidak ada pemecah kolom', () => {
    expect(csvCell(new Date('2026-10-17T03:00:00.000Z'))).toBe(
      '2026-10-17T03:00:00.000Z',
    );
  });

  it('menyerialkan objek JSON dan mengutipnya', () => {
    expect(csvCell({ items: [{ a: 1 }] })).toBe('"{""items"":[{""a"":1}]}"');
  });
});

describe('csvRow', () => {
  it('menggabungkan sel dengan koma', () => {
    expect(csvRow(['a', 'b,c', 3])).toBe('a,"b,c",3');
  });
});

describe('buildCsv', () => {
  it('menyertakan BOM dan akhir baris CRLF konsisten', () => {
    const csv = buildCsv(['nama', 'kg'], [['SPPG A', 12.5]]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toBe('\uFEFFnama,kg\r\nSPPG A,12.5\r\n');
  });
});