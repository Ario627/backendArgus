import type { LedgerEventType, UserRole } from '../common/constant/domain.constant.js';

export const APPENDABLE_LEDGER_EVENT_TYPES = Object.freeze([
  'DITIMBANG',
  'SERAH_TERIMA',
  'DITERIMA',
  'DIOLAH',
  'KELUARAN',
  'KOREKSI',
] as const);

export type AppendableLedgerEventType = (typeof APPENDABLE_LEDGER_EVENT_TYPES)[number];

export type TransferSide = 'KIRIM' | 'TERIMA';

const EVENT_ROLES: Readonly<Record<LedgerEventType, readonly UserRole[]>> = Object.freeze({
  DIKELUARKAN: [],
  DITIMBANG: ['sppg_staff', 'admin'],
  SERAH_TERIMA: ['sppg_staff', 'driver', 'facility', 'admin'],
  DITERIMA: ['facility', 'admin'],
  DIOLAH: ['facility', 'admin'],
  KELUARAN: ['facility', 'admin'],
  KOREKSI: ['admin'],
});

export const canAppendLedgerEvent = (role: UserRole, tipe: LedgerEventType): boolean =>
  EVENT_ROLES[tipe].includes(role);

export const deriveTransferSide = (
  role: UserRole,
  requested: TransferSide | undefined,
): TransferSide | null => {
  if (role === 'sppg_staff' || role === 'driver') return 'KIRIM';
  if (role === 'facility') return 'TERIMA';
  return requested ?? null;
};