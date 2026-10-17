import { Module } from '@nestjs/common';
import { OpsModule } from '../ops/ops.module.js';
import { AnomalyController } from './anomaly.controller.js';
import { AnomalyService } from './anomaly.service.js';
import { AnomalyWriterService } from './anomaly-writer.service.js';

@Module({
  imports: [OpsModule],
  controllers: [AnomalyController],
  providers: [AnomalyService, AnomalyWriterService],
  exports: [AnomalyWriterService],
})
export class AnomalyModule {}
