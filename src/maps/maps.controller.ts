import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { DirectionsReport } from './directions.types.js';
import { DirectionsService } from './directions.service.js';
import { parseCoordinatePair } from './directions.util.js';
import { DirectionsQueryDto } from './dto/directions-query.dto.js';
import { directionsCoordinateError } from './maps.errors.js';
import { TrafficRouteService } from './traffic.service.js';
import type { RouteAlternativesReport } from './traffic.types.js';

@Controller('maps')
export class MapsController {
  constructor(
    private readonly directionsService: DirectionsService,
    private readonly trafficRouteService: TrafficRouteService,
  ) {}

  @Get('directions')
  @Roles('admin', 'dlh_auditor', 'driver', 'sppg_staff', 'facility')
  async directions(
    @Query() query: DirectionsQueryDto,
  ): Promise<DirectionsReport> {
    return this.directionsService.directions(query.from, query.to);
  }

  @Get('route')
  @Roles('admin', 'dlh_auditor', 'driver', 'sppg_staff', 'facility')
  async route(
    @Query() query: DirectionsQueryDto,
  ): Promise<RouteAlternativesReport> {
    const from = parseCoordinatePair(query.from);
    const to = parseCoordinatePair(query.to);
    if (from === null || to === null) throw directionsCoordinateError();
    return this.trafficRouteService.route(from, to);
  }
}
