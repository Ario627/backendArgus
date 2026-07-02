import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { MqttController } from "./mqtt.controller";
import { TelemetryModule } from "src/telemetry/telemetry.module";
@Module({
  imports: [
    TelemetryModule,
    ClientsModule.registerAsync([
      {
        name: 'MQTT_SERVICE',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const mqtt = config.get<{
            brokerUrl: string;
            username: string;
            password: string;
            reconnectPeriodMs: number;
            connectTimeoutMs: number;
          }>('app.mqtt')!;
          return {
            transport: Transport.MQTT,
            options: {
              url: mqtt.brokerUrl,
              username: mqtt.username,
              password: mqtt.password,
              reconnectPeriod: mqtt.reconnectPeriodMs,
              connectTimeout: mqtt.connectTimeoutMs,
            },
          };
        },
      },
    ]),
  ],
  controllers: [MqttController],
})
export class MqttModule {}