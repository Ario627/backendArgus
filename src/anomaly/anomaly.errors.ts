import { ConflictException, NotFoundException } from '@nestjs/common';

export const anomalyNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'ANOMALY_NOT_FOUND',
    message: 'Anomali tidak ditemukan',
  });

export const anomalyClosedError = (): ConflictException =>
  new ConflictException({
    code: 'ANOMALY_CLOSED',
    message: 'Anomali sudah ditutup',
  });
