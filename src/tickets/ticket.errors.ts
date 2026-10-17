import {
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ApiErrorDetail } from '../common/types.js';

export const ticketNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'TICKET_NOT_FOUND',
    message: 'Tiket tidak ditemukan',
  });

export const sppgPublicNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'SPPG_PUBLIC_NOT_FOUND',
    message: 'Halaman dapur tidak ditemukan',
  });

export const ticketTransitionInvalidError = (
  details: readonly ApiErrorDetail[],
): ConflictException =>
  new ConflictException({
    code: 'TICKET_TRANSITION_INVALID',
    message: 'Perubahan status tiket tidak valid',
    details,
  });

export const ticketRateLimitedError = (scope: 'IP' | 'SPPG'): HttpException =>
  new HttpException(
    {
      code: 'TICKET_RATE_LIMITED',
      message: 'Terlalu banyak laporan, coba lagi nanti',
      details: [{ code: scope === 'IP' ? 'ratePerPelapor' : 'ratePerSppg' }],
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );

export const ticketFotoUnknownError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'TICKET_FOTO_UNKNOWN',
    message: 'Foto belum diunggah atau tidak dikenal',
    details: [{ code: 'fotoHash', field: 'fotoHash' }],
  });