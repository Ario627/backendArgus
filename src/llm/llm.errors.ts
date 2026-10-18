import { HttpException, HttpStatus } from '@nestjs/common';

export const narrativeRateLimitedError = (limitPerDay: number): HttpException =>
  new HttpException(
    {
      code: 'NARRATIVE_RATE_LIMITED',
      message: `Batas narasi ${limitPerDay} per hari sudah tercapai`,
      details: [{ code: 'limitPerDay', field: String(limitPerDay) }],
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );

export class LlmRequestError extends Error {
  constructor(
    readonly kode: 'TIMEOUT' | 'HTTP' | 'PARSE' | 'EMPTY',
    readonly status: number | null,
  ) {
    super(kode);
    this.name = 'LlmRequestError';
  }
}