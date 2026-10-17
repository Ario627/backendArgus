import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fleet } from '../database/entities/fleet.entity.js';
import { TelemetryRow } from '../database/entities/telemetry-row.entity.js';
import { MqttModule } from '../mqtt/mqtt.module.js';
import { FleetWatchdogService } from './fleet-watchdog.service.js';
import { TelemetryController } from './telemetry.controller.js';
import { TelemetryQueryService } from './telemetry-query.service.js';
import { TelemetryService } from './telemetry.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Fleet, TelemetryRow]), MqttModule],
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetryQueryService, FleetWatchdogService],
  exports: [TelemetryQueryService],
})
export class TelemetryModule {}