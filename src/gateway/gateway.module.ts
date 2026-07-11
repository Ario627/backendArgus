import { Module } from '@nestjs/common';
import { TelemetryModule } from 'src/telemetry/telemetry.module';
import { DashboardGateway } from './dashboard.gateway';

@Module({
  imports: [TelemetryModule],
  providers: [DashboardGateway],
  exports: [DashboardGateway],
})
export class GatewayModule {}
