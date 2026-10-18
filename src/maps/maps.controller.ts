import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { DirectionsReport } from './directions.types.js';
import { DirectionsService } from './directions.service.js';
import { DirectionsQueryDto } from './dto/directions-query.dto.js';

@Controller('maps')
export class MapsController {
  constructor(private readonly directionsService: DirectionsService) {}

  @Get('directions')
  @Roles('admin', 'dlh_auditor', 'driver', 'sppg_staff', 'facility')
  async directions(
    @Query() query: DirectionsQueryDto,
  ): Promise<DirectionsReport> {
    return this.directionsService.directions(query.from, query.to);
  }
}
