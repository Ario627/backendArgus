import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetEntity } from 'src/database/entities/fleet.entity';
import { RecoveryLogEntity } from 'src/database/entities/recovery-log.entity';
import { RoutePlanEntity } from 'src/database/entities/route-plan.entity';
import { LlmEngineModule } from 'src/llm/llm-engine.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([FleetEntity, RecoveryLogEntity, RoutePlanEntity]),
    LlmEngineModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
