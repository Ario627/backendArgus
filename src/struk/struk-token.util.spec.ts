import { describe, expect, it } from '@jest/globals';
import { signStrukToken, verifyStrukToken } from './struk-token.util.js';

const SECRET = 'uji-struk-secret-0123456789abcdef';
const BATCH_ID = '0199f5b0-1b0e-7a3c-9f2e-1c2d3e4f5a6b';
const NOW = new Date('2026-10-18T03:00:00.000Z');

const sign = (expiresAt: Date, batchId = BATCH_ID, secret = SECRET): string =>
  signStrukToken({ secret, batchId, expiresAt });

describe('signStrukToken', () => {
  it('menghasilkan token empat bagian dengan versi v1', () => {
    const token = sign(new Date('2026-11-17T03:00:00.000Z'));
    const parts = token.split('.');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
    expect(parts[1]).toBe(BATCH_ID);
    expect(parts[3]).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('menolak batch id yang bukan UUID dan kedaluwarsa tidak masuk akal', () => {
    expect(() => sign(NOW, 'bukan-uuid')).toThrow('STRUK_BATCH_ID_INVALID');
    expect(() => sign(new Date(0))).toThrow('STRUK_EXPIRY_INVALID');
  });

  it('deterministik untuk isi yang sama', () => {
    const expiresAt = new Date('2026-11-17T03:00:00.000Z');
    expect(sign(expiresAt)).toBe(sign(expiresAt));
  });
});

describe('verifyStrukToken', () => {
  const verify = (token: string, now = NOW, secret = SECRET) =>
    verifyStrukToken({ secret, token, now });

  it('menerima token yang ditandatangani dengan secret benar', () => {
    const token = sign(new Date('2026-11-17T03:00:00.000Z'));
    const hasil = verify(token);
    expect(hasil).toEqual({
      ok: true,
      batchId: BATCH_ID,
      expiresAt: new Date('2026-11-17T03:00:00.000Z'),
    });
  });

  it('menolak tanda tangan dari secret lain', () => {
    const token = sign(
      new Date('2026-11-17T03:00:00.000Z'),
      BATCH_ID,
      'secret-lain-0123456789abcdef',
    );
    expect(verify(token)).toEqual({ ok: false, reason: 'SIGNATURE' });
  });

  it('menolak muatan yang diubah setelah ditandatangani', () => {
    const token = sign(new Date('2026-11-17T03:00:00.000Z'));
    const parts = token.split('.');
    parts[2] = '4102444800';
    expect(verify(parts.join('.'))).toEqual({ ok: false, reason: 'SIGNATURE' });
  });

  it('menandai token yang kedaluwarsa tanpa menyalahkan tanda tangan', () => {
    const token = sign(new Date('2026-10-18T02:59:59.000Z'));
    expect(verify(token)).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('menolak bentuk token yang tidak dikenal sebagai malformed', () => {
    const valid = sign(new Date('2026-11-17T03:00:00.000Z'));
    const [version, batchId, epoch, signature] = valid.split('.');
    const malformed = [
      '',
      'v1',
      `v2.${batchId}.${epoch}.${signature}`,
      `v1.bukan-uuid.${epoch}.${signature}`,
      `v1.${batchId}.abc.${signature}`,
      `v1.${batchId}.${epoch}.pendek`,
      `${valid}.tambahan`,
    ];
    for (const token of malformed) {
      expect(verify(token)).toEqual({ ok: false, reason: 'MALFORMED' });
    }
    expect(version).toBe('v1');
  });
});