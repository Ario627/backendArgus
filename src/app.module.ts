import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import configuration, {
  type AppConfiguration,
} from './config/configuration.js';
import { AuthModule } from './auth/auth.module.js';
import { BatchModule } from './batch/batch.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DatabaseModule } from './database/database.module.js';
import { FacilityModule } from './facility/facility.module.js';
import { FleetModule } from './fleet/fleet.module.js';
import { HealthModule } from './health/health.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { MenuModule } from './menu/menu.module.js';
import { DispositionModule } from './disposition/disposition.module.js';
import { PhotoModule } from './photo/photo.module.js';
import { SppgModule } from './sppg/sppg.module.js';
import { SyncModule } from './sync/sync.module.js';
import { TelemetryModule } from './telemetry/telemetry.module.js';

const THROTTLE_WINDOW_MS = 60000;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<AppConfiguration>('app');
        return {
          throttlers: [
            { ttl: THROTTLE_WINDOW_MS, limit: config.throttle.globalPerMin },
          ],
        };
      },
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    SppgModule,
    FacilityModule,
    LedgerModule,
    BatchModule,
    MenuModule,
    FleetModule,
    TelemetryModule,
    SyncModule,
    DispositionModule,
    PhotoModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
