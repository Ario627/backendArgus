import { describe, expect, it } from '@jest/globals';
import { hitungSkorRisikoTiket } from './ticket-risk.util.js';

describe('hitungSkorRisikoTiket', () => {
  it('memberi skor dasar untuk tiket lain-lain tanpa sinyal apa pun', () => {
    const result = hitungSkorRisikoTiket({
      jenis: 'lainnya',
      anomali72h: 0,
      tersangkut72h: 0,
      berfoto: false,
    });
    expect(result.skor).toBe(15);
    expect(result.komponen).toEqual({
      dasar: 15,
      jenis: 0,
      anomali: 0,
      tersangkut: 0,
      foto: 0,
    });
  });

  it('menambah bonus jenis untuk bau, limbah_cair, dan tumpukan', () => {
    for (const jenis of ['bau', 'limbah_cair', 'tumpukan'] as const) {
      const result = hitungSkorRisikoTiket({
        jenis,
        anomali72h: 0,
        tersangkut72h: 0,
        berfoto: false,
      });
      expect(result.skor).toBe(30);
    }
  });

  it('menaikkan skor saat ada anomali 72 jam dan bonus ekstra di 3+', () => {
    const satu = hitungSkorRisikoTiket({
      jenis: 'bau',
      anomali72h: 1,
      tersangkut72h: 0,
      berfoto: false,
    });
    expect(satu.komponen['anomali']).toBe(20);
    const tiga = hitungSkorRisikoTiket({
      jenis: 'bau',
      anomali72h: 3,
      tersangkut72h: 0,
      berfoto: false,
    });
    expect(tiga.komponen['anomali']).toBe(35);
  });

  it('menaikkan skor saat lebih dari dua batch tersangkut', () => {
    const dua = hitungSkorRisikoTiket({
      jenis: 'lainnya',
      anomali72h: 0,
      tersangkut72h: 2,
      berfoto: false,
    });
    expect(dua.komponen['tersangkut']).toBe(0);
    const tiga = hitungSkorRisikoTiket({
      jenis: 'lainnya',
      anomali72h: 0,
      tersangkut72h: 3,
      berfoto: false,
    });
    expect(tiga.komponen['tersangkut']).toBe(25);
  });

  it('menambah bonus foto dan menjepit total di 100', () => {
    const result = hitungSkorRisikoTiket({
      jenis: 'limbah_cair',
      anomali72h: 5,
      tersangkut72h: 4,
      berfoto: true,
    });
    expect(result.skor).toBe(100);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.komponen)).toBe(true);
  });

  it('menjepit masukan hitungan negatif atau tidak wajar ke nol', () => {
    const result = hitungSkorRisikoTiket({
      jenis: 'tumpukan',
      anomali72h: -4,
      tersangkut72h: Number.NaN,
      berfoto: false,
    });
    expect(result.skor).toBe(30);
  });
});