import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ExportController } from './export.controller.js';
import { ExportService } from './export.service.js';

@Module({
  imports: [AuditModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
