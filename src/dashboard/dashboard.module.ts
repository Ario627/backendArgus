import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [LlmModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
