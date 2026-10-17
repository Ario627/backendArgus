import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { ProfileViolation } from './acceptance-profile.types.js';

export const facilityNotFoundError = (): NotFoundException =>
  new NotFoundException({ code: 'FACILITY_NOT_FOUND', message: 'Fasilitas tidak ditemukan' });

export const profileNotFoundError = (): NotFoundException =>
  new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Profil penerimaan belum ada' });

export const profileInvalidError = (violations: readonly ProfileViolation[]): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'PROFILE_INVALID',
    message: 'Profil penerimaan tidak valid',
    details: violations.map((violation) => ({ code: violation.rule, field: violation.path })),
  });