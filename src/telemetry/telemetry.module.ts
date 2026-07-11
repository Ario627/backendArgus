import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { FleetEntity } from "src/database/entities/fleet.entity";
import { TelemetryEntity } from "src/database/entities/telemetry.entity";
import { OptimizationModule } from "src/optimization/optimization.module";
import { TelemetryService } from "./telemetry.service";
import { FleetWatchdogService } from "./fleet-watchdog.service";
import { TelemetryEventsService } from "./telemetry-events.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([TelemetryEntity, FleetEntity]),
    ScheduleModule.forRoot(),
    OptimizationModule,
  ],
  providers: [TelemetryService, FleetWatchdogService, TelemetryEventsService],
  exports: [TelemetryService, TelemetryEventsService],
})
export class TelemetryModule {}