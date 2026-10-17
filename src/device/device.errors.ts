import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ApiErrorDetail } from '../common/types.js';

export const deviceNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'DEVICE_NOT_FOUND',
    message: 'Perangkat tidak ditemukan',
  });

export const deviceTargetInvalidError = (
  details: readonly ApiErrorDetail[],
): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'DEVICE_TARGET_INVALID',
    message: 'Penautan armada/SPPG perangkat tidak sesuai',
    details,
  });

export const deviceRevokedError = (): ConflictException =>
  new ConflictException({
    code: 'DEVICE_REVOKED',
    message: 'Perangkat sudah dicabut, tidak bisa diubah',
  });

export const deviceUsernameConflictError = (): ConflictException =>
  new ConflictException({
    code: 'DEVICE_MQTT_USERNAME_CONFLICT',
    message: 'Gagal membuat username MQTT unik, coba lagi',
  });