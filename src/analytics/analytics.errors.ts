import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';

export const analyticsUnavailableError = (): ServiceUnavailableException =>
  new ServiceUnavailableException({
    code: 'ANALYTICS_UNAVAILABLE',
    message: 'Layanan analitik sedang tidak tersedia; coba lagi',
  });

export const analyticsScanEmptyError = (): NotFoundException =>
  new NotFoundException({
    code: 'ANALYTICS_NO_SAMPLE',
    message: 'Belum ada timbangan manual pada rentang waktu ini',
  });