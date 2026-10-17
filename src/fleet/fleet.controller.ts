import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { uuidParamPipe } from '../common/pipes/uuid-param.pipe.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import {
  TelemetryQueryService,
  type FleetPositionReport,
} from '../telemetry/telemetry-query.service.js';
import { CreateFleetDto } from './dto/create-fleet.dto.js';
import {
  DEFAULT_POSITION_MINUTES,
  FleetPositionQueryDto,
} from './dto/fleet-position-query.dto.js';
import { FleetListQueryDto } from './dto/fleet-list-query.dto.js';
import { UpdateFleetDto } from './dto/update-fleet.dto.js';
import type { FleetDto } from './fleet.mapper.js';
import { FleetService } from './fleet.service.js';

@Controller('fleet')
export class FleetController {
  constructor(
    private readonly fleetService: FleetService,
    private readonly telemetryQueryService: TelemetryQueryService,
  ) {}

  @Get()
  @Roles('admin', 'dlh_auditor', 'driver')
  async list(
    @Query() query: FleetListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PaginatedItems<FleetDto>> {
    return this.fleetService.list(query, actor);
  }

  @Get(':id')
  @Roles('admin', 'dlh_auditor', 'driver')
  async detail(
    @Param('id', uuidParamPipe('id')) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<FleetDto> {
    return this.fleetService.getDetail(id, actor);
  }

  @Get(':id/positions')
  @Roles('admin', 'dlh_auditor', 'driver')
  async positions(
    @Param('id', uuidParamPipe('id')) id: string,
    @Query() query: FleetPositionQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<FleetPositionReport> {
    return this.telemetryQueryService.positions(
      id,
      query.minutes ?? DEFAULT_POSITION_MINUTES,
      actor,
    );
  }

  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateFleetDto): Promise<FleetDto> {
    return this.fleetService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  async update(
    @Param('id', uuidParamPipe('id')) id: string,
    @Body() dto: UpdateFleetDto,
  ): Promise<FleetDto> {
    return this.fleetService.update(id, dto);
  }
}