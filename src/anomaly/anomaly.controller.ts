import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { uuidParamPipe } from '../common/pipes/uuid-param.pipe.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import { AnomalyService, type CloseAnomalyResult } from './anomaly.service.js';
import { CloseAnomalyDto } from './dto/close-anomaly.dto.js';
import { AnomalyListQueryDto } from './dto/anomaly-list-query.dto.js';
import type { AnomalyDto } from './anomaly.mapper.js';

@Controller('anomalies')
export class AnomalyController {
  constructor(private readonly anomalyService: AnomalyService) {}

  @Get()
  @Roles('admin', 'dlh_auditor')
  async list(
    @Query() query: AnomalyListQueryDto,
  ): Promise<PaginatedItems<AnomalyDto>> {
    return this.anomalyService.list(query);
  }

  @Post(':id/close')
  @Roles('admin', 'dlh_auditor')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id', uuidParamPipe('id')) id: string,
    @Body() dto: CloseAnomalyDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<CloseAnomalyResult> {
    return this.anomalyService.close(id, dto, actor.id);
  }
}
