import { Module } from '@nestjs/common';
import { MapsClientService } from './maps-client.service.js';

@Module({
  providers: [MapsClientService],
  exports: [MapsClientService],
})
export class MapsClientModule {}