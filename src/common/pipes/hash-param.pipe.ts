import { type PipeTransform, UnprocessableEntityException } from '@nestjs/common';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export class Sha256ParamPipe implements PipeTransform<unknown, string> {
  constructor(private readonly field: string) {}

  transform(value: unknown): string {
    if (typeof value === 'string' && SHA256_HEX.test(value)) return value;
    throw new UnprocessableEntityException({
      code: 'SYS_VALIDATION',
      message: 'Data yang dikirim tidak valid',
      details: [{ code: 'isSha256', field: this.field }],
    });
  }
}

export const hashParamPipe = (field: string): Sha256ParamPipe => new Sha256ParamPipe(field);