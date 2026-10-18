import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Batch } from '../database/entities/batch.entity.js';
import { Device } from '../database/entities/device.entity.js';
import { Fleet } from '../database/entities/fleet.entity.js';
import { ScalePending } from '../database/entities/scale-pending.entity.js';
import { TelemetryRow } from '../database/entities/telemetry-row.entity.js';
import { DeviceModule } from '../device/device.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { MqttModule } from '../mqtt/mqtt.module.js';
import { OpsModule } from '../ops/ops.module.js';
import { FleetWatchdogService } from './fleet-watchdog.service.js';
import { ScaleController } from './scale.controller.js';
import { ScalePendingService } from './scale-pending.service.js';
import { ScaleService } from './scale.service.js';
import { TelemetryController } from './telemetry.controller.js';
import { TelemetryQueryService } from './telemetry-query.service.js';
import { TelemetryService } from './telemetry.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Fleet,
      TelemetryRow,
      Device,
      ScalePending,
      Batch,
    ]),
    MqttModule,
    DeviceModule,
    LedgerModule,
    OpsModule,
  ],
  controllers: [TelemetryController, ScaleController],
  providers: [
    TelemetryService,
    TelemetryQueryService,
    FleetWatchdogService,
    ScaleService,
    ScalePendingService,
  ],
  exports: [TelemetryQueryService],
})
export class TelemetryModule {}
