import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetEntity } from 'src/database/entities/fleet.entity';
import { DestinationEntity } from 'src/database/entities/destination.entity';
import { RoutePlanEntity } from 'src/database/entities/route-plan.entity';
import { RecoveryLogEntity } from 'src/database/entities/recovery-log.entity';
import { MapsModule } from 'src/maps/maps-client.module';
import { LlmEngineModule } from 'src/llm/llm-engine.module';
import { OptimizationService } from './optimization.service';
import { RecoveryService } from './recovery.service';
import { OptimizationController } from './optimization.controller';
import { RecoveryController } from './recovery.controller';

@Module({
  imports: [
    HttpModule,
    MapsModule,
    LlmEngineModule,
    TypeOrmModule.forFeature([
      FleetEntity,
      DestinationEntity,
      RoutePlanEntity,
      RecoveryLogEntity,
    ]),
  ],
  controllers: [OptimizationController, RecoveryController],
  providers: [OptimizationService, RecoveryService],
  exports: [OptimizationService, RecoveryService],
})
export class OptimizationModule {}
