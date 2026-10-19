import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { Batch } from '../database/entities/batch.entity.js';
import { Fleet } from '../database/entities/fleet.entity.js';
import { RoutePlan } from '../database/entities/route-plan.entity.js';
import { RouteStop } from '../database/entities/route-stop.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { MapsClientModule } from '../maps/maps-client.module.js';
import { ParameterModule } from '../parameter/parameter.module.js';
import { DispatchController } from './dispatch.controller.js';
import { DispatchService } from './dispatch.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Batch, Fleet, Sppg, RoutePlan, RouteStop]),
    MapsClientModule,
    ParameterModule,
    AuditModule,
  ],
  controllers: [DispatchController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}
