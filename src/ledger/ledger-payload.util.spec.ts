import { canonicalJson } from '../common/utils/hash.util.js';
import { buildLedgerPayload, type LedgerPayloadInput } from './ledger-payload.util.js';
import { describe, expect, it } from '@jest/globals';

const BASE_INPUT: LedgerPayloadInput = {
  batchId: '01a14521-c19a-72c2-b0c5-e545fa054e4e',
  tipe: 'DIKELUARKAN',
  beratKg: 12.4,
  aktor: '01a14521-0000-7000-8000-000000000001',
  deviceId: null,
  fotoHash: null,
  waktuKejadian: new Date('2026-10-17T02:40:00.000Z'),
  catatan: null,
  data: null,
  clientEventId: null,
};

describe('buildLedgerPayload', () => {
  it('menghasilkan kumpulan kunci tetap termasuk nilai null eksplisit', () => {
    const payload = buildLedgerPayload(BASE_INPUT);
    expect(Object.keys(payload).sort()).toEqual([
      'aktor',
      'batchId',
      'beratKg',
      'catatan',
      'clientEventId',
      'data',
      'deviceId',
      'fotoHash',
      'tipe',
      'waktuKejadian',
    ]);
    expect(payload.deviceId).toBeNull();
    expect(payload.data).toBeNull();
    expect(payload.waktuKejadian).toBe('2026-10-17T02:40:00.000Z');
  });

  it('deterministik: input sama menghasilkan kanonik yang sama walau urutan kunci berbeda', () => {
    const pertama = buildLedgerPayload(BASE_INPUT);
    const kedua = buildLedgerPayload({ ...BASE_INPUT });
    expect(canonicalJson(pertama)).toBe(canonicalJson(kedua));
  });

  it('nilai angka dibulatkan ke dua desimal secara deterministik', () => {
    const payload = buildLedgerPayload({ ...BASE_INPUT, beratKg: 0.1 + 0.2 });
    expect(payload.beratKg).toBe(0.3);
    const satu = buildLedgerPayload({ ...BASE_INPUT, beratKg: 12.005 });
    expect(satu.beratKg).toBe(12.01);
  });

  it('perubahan sekecil apa pun mengubah kanonik payload', () => {
    const dasar = canonicalJson(buildLedgerPayload(BASE_INPUT));
    const lain = canonicalJson(buildLedgerPayload({ ...BASE_INPUT, beratKg: 12.41 }));
    expect(dasar).not.toBe(lain);
  });

  it('salinan data terpisah dari objek pemanggil', () => {
    const data = { alasan: 'salah timbang' };
    const payload = buildLedgerPayload({ ...BASE_INPUT, tipe: 'KOREKSI', data });
    data.alasan = 'diubah setelahnya';
    expect((payload.data as { alasan: string }).alasan).toBe('salah timbang');
  });
});