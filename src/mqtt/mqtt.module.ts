import { Module } from "@nestjs/common";
import { MqttController } from "./mqtt.controller";
import { TelemetryModule } from "src/telemetry/telemetry.module";
import { DestinationModule } from "src/destination/destination.module";

@Module({
  imports: [TelemetryModule, DestinationModule],
  controllers: [MqttController],
})
export class MqttModule {}