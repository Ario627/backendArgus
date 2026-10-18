import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Batch } from '../database/entities/batch.entity.js';
import { Facility } from '../database/entities/facility.entity.js';
import { RoutePlan } from '../database/entities/route-plan.entity.js';
import { RouteStop } from '../database/entities/route-stop.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { MapsClientModule } from '../maps/maps-client.module.js';
import { OpsModule } from '../ops/ops.module.js';
import { ParameterModule } from '../parameter/parameter.module.js';
import { OptimizerClient } from './optimizer.client.js';
import { RecoveryService } from './recovery.service.js';
import { RoutingController } from './routing.controller.js';
import { RoutingService } from './routing.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoutePlan, RouteStop, Batch, Facility, Sppg]),
    MapsClientModule,
    OpsModule,
    ParameterModule,
  ],
  controllers: [RoutingController],
  providers: [RoutingService, OptimizerClient, RecoveryService],
  exports: [RoutingService],
})
export class RoutingModule {}
