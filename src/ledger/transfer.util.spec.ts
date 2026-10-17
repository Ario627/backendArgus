import { evaluateTransfer, extractTransferWitnesses, type TransferWitness } from './transfer.util.js';
import type { LedgerEvent } from '../database/entities/ledger-event.entity.js';
import { describe, expect, it } from '@jest/globals';


const witness = (
  eventId: number,
  actorId: string,
  side: 'KIRIM' | 'TERIMA',
  weightKg: number,
): TransferWitness => ({ eventId, actorId, side, weightKg });

describe('extractTransferWitnesses', () => {
  const row = (partial: Partial<LedgerEvent>): LedgerEvent =>
    ({ id: 1, tipe: 'SERAH_TERIMA', beratKg: 10, aktor: 'a-1', payload: {}, ...partial }) as LedgerEvent;

  it('mengambil saksi hanya dari event SERAH_TERIMA dengan sisi yang sah', () => {
    const rows = [
      row({ payload: { data: { sisi: 'KIRIM' } } }),
      row({ id: 2, payload: { data: { sisi: 'TERIMA' } }, aktor: 'a-2' }),
      row({ id: 3, tipe: 'DITIMBANG', payload: { data: { sisi: 'KIRIM' } } }),
      row({ id: 4, payload: { data: null } }),
      row({ id: 5, payload: {} }),
      row({ id: 6, payload: { data: { sisi: 'BUKAN' } } }),
      row({ id: 7, beratKg: null, payload: { data: { sisi: 'KIRIM' } } }),
    ];
    const witnesses = extractTransferWitnesses(rows);
    expect(witnesses.map((entry) => entry.eventId)).toEqual([1, 2]);
    expect(witnesses[0]).toEqual({ eventId: 1, actorId: 'a-1', side: 'KIRIM', weightKg: 10 });
  });
});

describe('evaluateTransfer', () => {
  it('belum ada saksi sama sekali menghasilkan status null', () => {
    const result = evaluateTransfer([], 0.05);
    expect(result.status).toBeNull();
    expect(result.handedOverKg).toBeNull();
  });

  it('satu sisi saja menunggu konfirmasi pihak lain', () => {
    const result = evaluateTransfer([witness(1, 'staff-1', 'KIRIM', 12.4)], 0.05);
    expect(result.status).toBe('MENUNGGU_KONFIRMASI');
    expect(result.notes).toContain('MENUNGGU_SAKSI_PENERIMA');
    expect(result.handedOverKg).toBe(12.4);
  });

  it('dua aktor berbeda dalam toleransi menghasilkan SAH dengan berat serah rata-rata', () => {
    const result = evaluateTransfer(
      [witness(1, 'staff-1', 'KIRIM', 12.4), witness(2, 'fasil-1', 'TERIMA', 12.3)],
      0.05,
    );
    expect(result.status).toBe('SAH');
    expect(result.withinTolerance).toBe(true);
    expect(result.handedOverKg).toBe(12.35);
    expect(result.diffKg).toBe(0.1);
    expect(result.notes).toEqual([]);
  });

  it('selisih saksi melebihi toleransi tidak pernah SAH dan memakai berat pengirim', () => {
    const result = evaluateTransfer(
      [witness(1, 'staff-1', 'KIRIM', 12.4), witness(2, 'fasil-1', 'TERIMA', 11.0)],
      0.05,
    );
    expect(result.status).toBe('MENUNGGU_KONFIRMASI');
    expect(result.withinTolerance).toBe(false);
    expect(result.handedOverKg).toBe(12.4);
    expect(result.notes).toContain('SAKSI_SELISIH_MELEBIHI_TOLERANSI');
  });

  it('saksi dari aktor yang sama tidak pernah menghasilkan SAH', () => {
    const result = evaluateTransfer(
      [witness(1, 'admin-1', 'KIRIM', 12.4), witness(2, 'admin-1', 'TERIMA', 12.4)],
      0.05,
    );
    expect(result.status).toBe('MENUNGGU_KONFIRMASI');
    expect(result.notes).toContain('SAKSI_AKTOR_SAMA');
  });

  it('tanpa parameter toleransi, penilaian tidak menebak', () => {
    const result = evaluateTransfer(
      [witness(1, 'staff-1', 'KIRIM', 12.4), witness(2, 'fasil-1', 'TERIMA', 12.3)],
      null,
    );
    expect(result.withinTolerance).toBeNull();
    expect(result.status).toBe('MENUNGGU_KONFIRMASI');
    expect(result.notes).toContain('TOLERANSI_BELUM_TERKALIBRASI');
  });

  it('merata-ratakan beberapa saksi per sisi secara presisi', () => {
    const result = evaluateTransfer(
      [
        witness(1, 'staff-1', 'KIRIM', 12.4),
        witness(2, 'staff-2', 'KIRIM', 12.3),
        witness(3, 'fasil-1', 'TERIMA', 12.35),
      ],
      0.05,
    );
    expect(result.senderKg).toBe(12.35);
    expect(result.receiverKg).toBe(12.35);
    expect(result.status).toBe('SAH');
  });
});