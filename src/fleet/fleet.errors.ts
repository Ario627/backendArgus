import { ConflictException, NotFoundException } from '@nestjs/common';

export const fleetNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'FLEET_NOT_FOUND',
    message: 'Armada tidak ditemukan',
  });

export const fleetKodeConflictError = (): ConflictException =>
  new ConflictException({
    code: 'FLEET_KODE_CONFLICT',
    message: 'Kode armada sudah dipakai',
  });