import { ParseUUIDPipe, UnprocessableEntityException } from '@nestjs/common';

export const uuidParamPipe = (field: string): ParseUUIDPipe =>
  new ParseUUIDPipe({
    exceptionFactory: (): UnprocessableEntityException =>
      new UnprocessableEntityException({
        code: 'SYS_VALIDATION',
        message: 'Data yang dikirim tidak valid',
        details: [{ code: 'isUuid', field }],
      }),
  });
