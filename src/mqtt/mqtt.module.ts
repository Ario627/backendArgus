import { Module } from '@nestjs/common';
import { MqttClientService } from './mqtt-client.service.js';

@Module({
  providers: [MqttClientService],
  exports: [MqttClientService],
})
export class MqttModule {}