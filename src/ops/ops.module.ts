import { Module } from '@nestjs/common';
import { OpsNotifierService } from './ops-notifier.service.js';

@Module({
  providers: [OpsNotifierService],
  exports: [OpsNotifierService],
})
export class OpsModule {}