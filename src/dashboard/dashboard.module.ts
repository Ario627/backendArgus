import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module.js';
import { ParameterModule } from '../parameter/parameter.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [LlmModule, ParameterModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
