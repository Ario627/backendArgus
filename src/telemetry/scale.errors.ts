import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export type ScaleDropReason =
  | 'UKURAN'
  | 'TOPIC_INVALID'
  | 'BUKAN_JSON'
  | 'BENTUK_INVALID'
  | 'DEVICE_MISMATCH'
  | 'RATE_LIMITED'
  | 'DEVICE_TIDAK_DIKENAL'
  | 'PERANGKAT_DICABUT'
  | 'SECRET_TAK_TERBACA'
  | 'SIG_INVALID'
  | 'TIME_SKEW'
  | 'REPLAY';

export const scalePendingNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'SCALE_PENDING_NOT_FOUND',
    message: 'Penimbangan menunggu tidak ditemukan',
  });

export const scalePendingClosedError = (): ConflictException =>
  new ConflictException({
    code: 'SCALE_PENDING_CLOSED',
    message: 'Penimbangan sudah ditautkan atau diarsipkan',
  });

export const scaleLinkBatchMismatchError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'SCALE_LINK_BATCH_MISMATCH',
    message: 'Batch bukan milik SPPG perangkat timbangan ini',
    details: [{ code: 'sppgMismatch', field: 'batchId' }],
  });