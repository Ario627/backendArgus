import { Module } from '@nestjs/common';
import { MqttModule } from '../mqtt/mqtt.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [MqttModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
