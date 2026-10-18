import { GoneException, NotFoundException } from '@nestjs/common';
import type { StrukTokenFailure } from './struk-token.util.js';

const NOT_FOUND_MESSAGE = 'Tautan struk tidak dikenal';

export const strukTokenInvalidError = (
  reason: StrukTokenFailure,
): NotFoundException | GoneException =>
  reason === 'EXPIRED'
    ? new GoneException({
        code: 'STRUK_EXPIRED',
        message: 'Tautan struk sudah kedaluwarsa',
      })
    : new NotFoundException({
        code: 'STRUK_NOT_FOUND',
        message: NOT_FOUND_MESSAGE,
      });