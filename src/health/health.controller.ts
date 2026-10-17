import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { RawResponse } from '../common/decorators/raw-response.decorator.js';
import { HealthService, type HealthReport } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @RawResponse()
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthReport> {
    const report = await this.healthService.probe();
    response.setHeader('Cache-Control', 'no-store');
    if (report.status !== 'ok') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return report;
  }
}
