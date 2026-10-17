import { USER_ROLES, type UserRole } from '../common/constant/domain.constant.js';
import {
  APPENDABLE_LEDGER_EVENT_TYPES,
  canAppendLedgerEvent,
  deriveTransferSide,
} from './ledger-permission.util.js';
import { describe, expect, it } from '@jest/globals';


const EXPECTED_MATRIX: Readonly<
  Record<(typeof APPENDABLE_LEDGER_EVENT_TYPES)[number], readonly UserRole[]>
> = {
  DITIMBANG: ['sppg_staff', 'admin'],
  SERAH_TERIMA: ['sppg_staff', 'driver', 'facility', 'admin'],
  DITERIMA: ['facility', 'admin'],
  DIOLAH: ['facility', 'admin'],
  KELUARAN: ['facility', 'admin'],
  KOREKSI: ['admin'],
};

describe('matriks izin ledger', () => {
  it('mengizinkan tepat peran yang tercantum untuk setiap tipe event', () => {
    for (const tipe of APPENDABLE_LEDGER_EVENT_TYPES) {
      for (const role of USER_ROLES) {
        expect(canAppendLedgerEvent(role, tipe)).toBe(EXPECTED_MATRIX[tipe].includes(role));
      }
    }
  });

  it('tidak pernah mengizinkan DIKELUARKAN lewat endpoint', () => {
    for (const role of USER_ROLES) {
      expect(canAppendLedgerEvent(role, 'DIKELUARKAN')).toBe(false);
    }
  });

  it('menurunkan sisi transfer dari peran: staf dan pengemudi kirim, fasilitas terima', () => {
    expect(deriveTransferSide('sppg_staff', undefined)).toBe('KIRIM');
    expect(deriveTransferSide('driver', undefined)).toBe('KIRIM');
    expect(deriveTransferSide('facility', undefined)).toBe('TERIMA');
    expect(deriveTransferSide('admin', 'TERIMA')).toBe('TERIMA');
    expect(deriveTransferSide('admin', 'KIRIM')).toBe('KIRIM');
    expect(deriveTransferSide('admin', undefined)).toBeNull();
  });
});