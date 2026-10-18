import { Module } from '@nestjs/common';
import { AnomalyModule } from '../anomaly/anomaly.module.js';
import { ParameterModule } from '../parameter/parameter.module.js';
import { AnalyticsClient } from './analytics.client.js';
import { AnalyticsController } from './analytics.controller.js';
import { DigitSampleService } from './digit-sample.service.js';
import { DigitScanService } from './digit-scan.service.js';

@Module({
  imports: [AnomalyModule, ParameterModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsClient, DigitSampleService, DigitScanService],
  exports: [DigitScanService],
})
export class AnalyticsModule {}