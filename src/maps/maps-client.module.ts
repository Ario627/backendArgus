import { Module } from '@nestjs/common';
import { ParameterModule } from '../parameter/parameter.module.js';
import { DirectionsService } from './directions.service.js';
import { MapsClientService } from './maps-client.service.js';
import { MapsController } from './maps.controller.js';
import { TrafficRouteService } from './traffic.service.js';

@Module({
  imports: [ParameterModule],
  controllers: [MapsController],
  providers: [MapsClientService, DirectionsService, TrafficRouteService],
  exports: [MapsClientService],
})
export class MapsClientModule {}
