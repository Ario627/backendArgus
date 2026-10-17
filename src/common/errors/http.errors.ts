import { ForbiddenException } from '@nestjs/common';
import type { ApiErrorDetail } from '../types.js';

export const forbiddenActionError = (
  details?: readonly ApiErrorDetail[],
): ForbiddenException =>
  new ForbiddenException({
    code: 'RBAC_FORBIDDEN',
    message: 'Anda tidak punya akses untuk tindakan ini',
    ...(details === undefined ? {} : { details }),
  });
