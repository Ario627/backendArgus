import {
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ApiErrorDetail } from '../common/types.js';

export const exportRangeInvalidError = (
  details: readonly ApiErrorDetail[],
): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'EXPORT_RANGE_INVALID',
    message: 'Rentang tanggal ekspor tidak valid',
    details,
  });

export const exportRateLimitedError = (limitPerDay: number): HttpException =>
  new HttpException(
    {
      code: 'EXPORT_RATE_LIMITED',
      message: `Kuota ekspor ${limitPerDay} per hari sudah habis`,
      details: [{ code: 'limitPerDay', field: String(limitPerDay) }],
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
