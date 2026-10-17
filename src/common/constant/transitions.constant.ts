import { ConflictException } from '@nestjs/common';
import type { BatchStatus, LedgerEventType, TicketStatus } from './domain.constant.js';

export const BATCH_STATUS_TRANSITIONS: Readonly<Record<BatchStatus, readonly BatchStatus[]>> = Object.freeze({
  DICATAT: Object.freeze(['MENUNGGU_ANGKUT', 'GAGAL_GATE', 'TERSANGKUT'] as const),
  MENUNGGU_ANGKUT: Object.freeze(['DIANGKUT', 'GAGAL_GATE', 'TERSANGKUT'] as const),
  DIANGKUT: Object.freeze(['DITERIMA', 'TERSANGKUT'] as const),
  DITERIMA: Object.freeze(['DIOLAH'] as const),
  DIOLAH: Object.freeze(['SELESAI'] as const),
  GAGAL_GATE: Object.freeze(['MENUNGGU_ANGKUT', 'TERSANGKUT'] as const),
  SELESAI: Object.freeze([] as const),
  TERSANGKUT: Object.freeze([] as const),
});

export const LEDGER_EVENTS_BY_BATCH_STATUS: Readonly<Record<BatchStatus, readonly LedgerEventType[]>> = Object.freeze({
  DICATAT: Object.freeze(['DIKELUARKAN', 'DITIMBANG', 'KOREKSI'] as const),
  MENUNGGU_ANGKUT: Object.freeze(['DITIMBANG', 'SERAH_TERIMA', 'KOREKSI'] as const),
  DIANGKUT: Object.freeze(['SERAH_TERIMA', 'DITERIMA', 'KOREKSI'] as const),
  DITERIMA: Object.freeze(['DITERIMA', 'DIOLAH', 'KOREKSI'] as const),
  DIOLAH: Object.freeze(['DIOLAH', 'KELUARAN', 'KOREKSI'] as const),
  GAGAL_GATE: Object.freeze(['DITIMBANG', 'KOREKSI'] as const),
  SELESAI: Object.freeze(['KOREKSI'] as const),
  TERSANGKUT: Object.freeze(['KOREKSI'] as const),
});

export const TICKET_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = Object.freeze({
  BARU: Object.freeze(['DIVERIFIKASI', 'DITOLAK_MODERASI'] as const),
  DIVERIFIKASI: Object.freeze(['DITANGGAPI', 'DITOLAK_MODERASI'] as const),
  DITANGGAPI: Object.freeze(['SELESAI'] as const),
  SELESAI: Object.freeze([] as const),
  DITOLAK_MODERASI: Object.freeze([] as const),
});

export interface TransitionError {
  readonly code: string;
  readonly message: string;
}

export const assertTransition = <S extends string>(
  from: S,
  to: S,
  table: Readonly<Record<S, readonly S[]>>,
  error: TransitionError,
): void => {
  if (!table[from].includes(to)) {
    throw new ConflictException({ code: error.code, message: error.message });
  }
};

export const isLedgerEventAllowed = (status: BatchStatus, eventType: LedgerEventType): boolean =>
  LEDGER_EVENTS_BY_BATCH_STATUS[status].includes(eventType);