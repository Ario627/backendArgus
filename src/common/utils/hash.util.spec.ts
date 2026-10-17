import { describe, expect, it } from '@jest/globals';
import type { LedgerChainRow } from './hash.util.js';
import { canonicalJson, hitungHash, safeHashEquals, verifyChain } from './hash.util.js';

const PAYLOAD_DIKELUARKAN = {
  tipe: 'DIKELUARKAN',
  beratKg: 12.4,
  aktor: null,
  waktuKejadian: '2026-10-16T02:40:00.000Z',
} as const;

const PAYLOAD_DITIMBANG = {
  tipe: 'DITIMBANG',
  beratKg: 12.4,
  deviceId: null,
  waktuKejadian: '2026-10-16T02:41:00.000Z',
} as const;

const HASH_EVENT_1 = '7da35f6aa3d19350ff9e2625f1622389d6ddc1639868026e1cd06628dc29b225';
const HASH_EVENT_2 = '2889c51259cbfdf139451b22c390fcbcf0881be7322f45cbe87bc9f7f7ccbbb6';
const HASH_EVENT_1_VARIASI = 'c95339a1b506cd7c0370e58bdef1eda6abc06c28b1bfa44ce1d651f0615a73ce';

describe('canonicalJson', () => {
  it('mengurutkan kunci bersarang secara rekursif', () => {
    const tidakTerurut = { b: { d: 2, c: [3, 'x'] }, a: 1 };
    const terurut = { a: 1, b: { c: [3, 'x'], d: 2 } };
    expect(canonicalJson(tidakTerurut)).toBe('{"a":1,"b":{"c":[3,"x"],"d":2}}');
    expect(canonicalJson(terurut)).toBe(canonicalJson(tidakTerurut));
  });

  it('mempertahankan unicode utuh', () => {
    const payload = { nama: 'Tumis kangkung — "segar" ✓', beratKg: 4.25 };
    expect(canonicalJson(payload)).toBe('{"beratKg":4.25,"nama":"Tumis kangkung — \\"segar\\" ✓"}');
  });

  it('menolak nilai yang tidak bisa dikanonikalisasi secara aman', () => {
    expect(() => canonicalJson({ a: undefined })).toThrow(TypeError);
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(TypeError);
    expect(() => canonicalJson({ a: Number.POSITIVE_INFINITY })).toThrow(TypeError);
    expect(() => canonicalJson({ a: new Date() })).toThrow(TypeError);
    expect(() => canonicalJson({ a: (): number => 1 })).toThrow(TypeError);
    const berlubang: unknown[] = [1];
    berlubang[2] = 3;
    expect(() => canonicalJson(berlubang)).toThrow(TypeError);
    const berakses = Object.defineProperty({}, 'x', { get: () => 1, enumerable: true });
    expect(() => canonicalJson(berakses)).toThrow(TypeError);
  });
});

describe('hitungHash', () => {
  it('menghasilkan vektor beku untuk rantai dua event', () => {
    const hash1 = hitungHash(null, PAYLOAD_DIKELUARKAN);
    const hash2 = hitungHash(hash1, PAYLOAD_DITIMBANG);
    expect(hash1).toBe(HASH_EVENT_1);
    expect(hash2).toBe(HASH_EVENT_2);
  });

  it('berubah ketika satu nilai payload berubah', () => {
    const variasi = hitungHash(null, { ...PAYLOAD_DIKELUARKAN, beratKg: 12.41 });
    expect(variasi).toBe(HASH_EVENT_1_VARIASI);
    expect(variasi).not.toBe(HASH_EVENT_1);
  });
});

describe('safeHashEquals', () => {
  it('membandingkan hash dengan aman', () => {
    expect(safeHashEquals(HASH_EVENT_1, HASH_EVENT_1)).toBe(true);
    expect(safeHashEquals(HASH_EVENT_1, HASH_EVENT_2)).toBe(false);
    expect(safeHashEquals(HASH_EVENT_1, HASH_EVENT_1.slice(0, 63))).toBe(false);
  });
});

describe('verifyChain', () => {
  const rows: readonly LedgerChainRow[] = [
    { id: 1, prevHash: null, hash: HASH_EVENT_1, payload: PAYLOAD_DIKELUARKAN },
    { id: 2, prevHash: HASH_EVENT_1, hash: HASH_EVENT_2, payload: PAYLOAD_DITIMBANG },
  ];

  it('lolos untuk rantai utuh', () => {
    const hasil = verifyChain(rows);
    expect(hasil.ok).toBe(true);
    expect(hasil.checked).toBe(2);
    expect(hasil.breach).toBeNull();
  });

  it('mendeteksi payload yang diubah', () => {
    const dirusak = [rows[0], { ...rows[1], payload: { ...PAYLOAD_DITIMBANG, beratKg: 12.41 } }];
    const hasil = verifyChain(dirusak);
    expect(hasil.ok).toBe(false);
    expect(hasil.checked).toBe(1);
    expect(hasil.breach?.reason).toBe('HASH_MISMATCH');
    expect(hasil.breach?.index).toBe(1);
  });

  it('mendeteksi prev_hash yang dipalsukan', () => {
    const dipalsukan = [rows[0], { ...rows[1], prevHash: 'f'.repeat(64) }];
    const hasil = verifyChain(dipalsukan);
    expect(hasil.ok).toBe(false);
    expect(hasil.breach?.reason).toBe('PREV_LINK_MISMATCH');
  });

  it('menolak event pertama yang tidak bergenesis', () => {
    const salahAwal = [{ ...rows[0], prevHash: 'a'.repeat(64) }, rows[1]];
    const hasil = verifyChain(salahAwal);
    expect(hasil.ok).toBe(false);
    expect(hasil.breach?.reason).toBe('PREV_LINK_MISMATCH');
    expect(hasil.breach?.index).toBe(0);
  });
});