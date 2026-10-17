import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { Fleet } from '../database/entities/fleet.entity.js';
import { FleetController } from './fleet.controller.js';
import { FleetService } from './fleet.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Fleet]), TelemetryModule],
  controllers: [FleetController],
  providers: [FleetService],
  exports: [FleetService],
})
export class FleetModule {}