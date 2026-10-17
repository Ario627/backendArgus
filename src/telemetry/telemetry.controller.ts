import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { uuidParamPipe } from '../common/pipes/uuid-param.pipe.js';
import {
  TelemetryQueryService,
  type TelemetryLatestReport,
} from './telemetry-query.service.js';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryQueryService: TelemetryQueryService) {}

  @Get(':fleetId/latest')
  @Roles('admin', 'dlh_auditor')
  async latest(
    @Param('fleetId', uuidParamPipe('fleetId')) fleetId: string,
  ): Promise<TelemetryLatestReport> {
    return this.telemetryQueryService.latest(fleetId);
  }
}