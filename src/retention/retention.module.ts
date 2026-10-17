import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { OpsModule } from '../ops/ops.module.js';
import { PhotoModule } from '../photo/photo.module.js';
import { RetentionController } from './retention.controller.js';
import { RetentionService } from './retention.service.js';

@Module({
  imports: [AuditModule, OpsModule, PhotoModule],
  controllers: [RetentionController],
  providers: [RetentionService],
})
export class RetentionModule {}