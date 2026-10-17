import { NotFoundException } from '@nestjs/common';

export const sppgNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'SPPG_NOT_FOUND',
    message: 'SPPG tidak ditemukan',
  });

export const sppgPointNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'SPPG_POINT_NOT_FOUND',
    message: 'Titik distribusi tidak ditemukan',
  });
