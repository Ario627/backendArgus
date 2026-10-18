import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { uuidParamPipe } from '../common/pipes/uuid-param.pipe.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import { ConfirmStopDto } from './dto/confirm-stop.dto.js';
import { PlanRouteDto } from './dto/plan-route.dto.js';
import { RouteListQueryDto } from './dto/route-list-query.dto.js';
import type {
  RoutePlanDetailDto,
  RoutePlanDto,
  RouteStopDto,
} from './routing.mapper.js';
import { RoutingService, type PlanRouteResult } from './routing.service.js';

@Controller('routes')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post('plan')
  @Roles('admin')
  async plan(
    @Body() dto: PlanRouteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlanRouteResult> {
    const result = await this.routingService.plan(dto, actor);
    response.status(result.degraded ? HttpStatus.ACCEPTED : HttpStatus.CREATED);
    return result;
  }

  @Get()
  @Roles('admin', 'dlh_auditor', 'driver')
  async list(
    @Query() query: RouteListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PaginatedItems<RoutePlanDto>> {
    return this.routingService.list(query, actor);
  }

  @Get(':id')
  @Roles('admin', 'dlh_auditor', 'driver')
  async detail(
    @Param('id', uuidParamPipe('id')) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<RoutePlanDetailDto> {
    return this.routingService.getDetail(id, actor);
  }

  @Patch(':id/stops/:stopId')
  @Roles('admin', 'driver')
  async confirmStop(
    @Param('id', uuidParamPipe('id')) id: string,
    @Param('stopId', uuidParamPipe('stopId')) stopId: string,
    @Body() dto: ConfirmStopDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<RouteStopDto> {
    return this.routingService.confirmStop(id, stopId, dto, actor);
  }

  @Post(':id/replan')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async replan(
    @Param('id', uuidParamPipe('id')) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PlanRouteResult> {
    return this.routingService.replan(id, actor);
  }
}
