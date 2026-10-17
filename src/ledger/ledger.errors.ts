import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import type { ApiErrorDetail } from '../common/types.js';

export const ledgerSequenceError = (): ConflictException =>
  new ConflictException({
    code: 'LEDGER_CHAIN_SEQUENCE',
    message: 'Tahap ini belum bisa dicatat sekarang',
  });

export const ledgerWeightRequiredError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'LEDGER_WEIGHT_REQUIRED',
    message: 'Berat wajib diisi untuk tahap ini',
  });

export const ledgerEventRoleForbiddenError = (tipe: string): ForbiddenException =>
  new ForbiddenException({
    code: 'RBAC_FORBIDDEN',
    message: 'Anda tidak punya akses untuk tindakan ini',
    details: [{ code: 'EVENT_ROLE_FORBIDDEN', field: tipe }],
  });

export const ledgerCorrectionInvalidError = (
  details: readonly ApiErrorDetail[],
): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'LEDGER_CORRECTION_INVALID',
    message: 'Koreksi wajib memuat alasan dan merujuk event yang dikoreksi',
    details,
  });

export const ledgerTimeInFutureError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'LEDGER_TIME_IN_FUTURE',
    message: 'Waktu tidak boleh di masa depan',
  });

export const ledgerSideRequiredError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'LEDGER_SIDE_REQUIRED',
    message: 'Admin wajib mengirim sisi transfer (KIRIM atau TERIMA)',
  });