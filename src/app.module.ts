import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { FleetModule } from "./fleet/fleet.module";
import { DestinationModule } from "./destination/destination.module";
import { MapsModule } from "./maps/maps-client.module";
import { LlmEngineModule } from "./llm/llm-engine.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { HealthModule } from "./health/health.module";
import configuration from "./config/configuration";
import { ScheduleModule } from "@nestjs/schedule";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { MqttModule } from "./mqtt/mqtt.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.get<{ url: string; poolSize: number }>(
          'app.database',
        )!;
        return {
          type: 'postgres' as const,
          url: db.url,
          autoLoadEntities: true,
          synchronize: false,
          extra: { poolSize: db.poolSize },
        };
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    FleetModule,
    DestinationModule,
    MapsModule,
    LlmEngineModule,
    TelemetryModule,
    MqttModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}