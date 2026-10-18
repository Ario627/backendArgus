import { UnprocessableEntityException } from '@nestjs/common';
import type { ApiErrorDetail } from '../common/types.js';

export const parameterValueInvalidError = (
  details: readonly ApiErrorDetail[],
): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'PARAMETER_VALUE_INVALID',
    message: 'Nilai parameter tidak valid',
    details,
  });