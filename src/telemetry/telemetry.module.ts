import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { FleetEntity } from "src/database/entities/fleet.entity";
import { TelemetryEntity } from "src/database/entities/telemetry.entity";
import { TelemetryService } from "./telemetry.service";
import { FleetWatchdogService } from "./fleet-watchdog.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([TelemetryEntity, FleetEntity]),
    ScheduleModule.forRoot(),
  ],
  providers: [TelemetryService, FleetWatchdogService],
  exports: [TelemetryService],
})
export class TelemetryModule {}