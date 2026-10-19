import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ApiErrorDetail } from '../common/types.js';

export const batchNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'BATCH_NOT_FOUND',
    message: 'Batch tidak ditemukan',
  });

export const batchWeightRangeError = (
  details?: readonly ApiErrorDetail[],
): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'BATCH_WEIGHT_RANGE',
    message: 'Berat harus antara 0,1 dan 500 kg',
    ...(details === undefined ? {} : { details }),
  });

export const batchFractionsInvalidError = (
  details: readonly ApiErrorDetail[],
): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'BATCH_FRACTIONS_INVALID',
    message: 'Periksa lagi pilihan fraksi',
    details,
  });

export const batchTimeInFutureError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'BATCH_TIME_IN_FUTURE',
    message: 'Waktu tidak boleh di masa depan',
  });

export const batchTimeTooOldError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'BATCH_TIME_TOO_OLD',
    message: 'Data terlalu lama; hubungi admin bila ini koreksi',
  });

export const batchIdConflictError = (): ConflictException =>
  new ConflictException({
    code: 'BATCH_ID_CONFLICT',
    message: 'Id batch sudah dipakai untuk catatan lain',
  });

export const gateNotRetryableError = (): ConflictException =>
  new ConflictException({
    code: 'GATE_NOT_RETRYABLE',
    message: 'Gate hanya bisa dievaluasi ulang saat batch berstatus GAGAL_GATE',
  });
