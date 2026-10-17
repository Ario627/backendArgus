import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { uuidParamPipe } from '../common/pipes/uuid-param.pipe.js';
import type { AuthenticatedUser } from '../common/types.js';
import { DispositionService, type RunReport } from './disposition.service.js';
import type { BatchDispositionDetail, DispositionQueueItem } from './disposition.mapper.js';
import { DispositionListQueryDto } from './dto/disposition-list-query.dto.js';
import { RunDispositionDto } from './dto/run-disposition.dto.js';

@Controller('dispositions')
export class DispositionController {
  constructor(private readonly dispositionService: DispositionService) {}

  @Get()
  @Roles('admin', 'dlh_auditor', 'sppg_staff', 'facility')
  list(
    @Query() query: DispositionListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<readonly DispositionQueueItem[]> {
    return this.dispositionService.list(query, user);
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'dlh_auditor')
  run(
    @Body() dto: RunDispositionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunReport> {
    return this.dispositionService.run(dto, user);
  }
}

@Controller('batches')
export class BatchDispositionController {
  constructor(private readonly dispositionService: DispositionService) {}

  @Get(':id/disposition')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  detail(
    @Param('id', uuidParamPipe('id')) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchDispositionDetail> {
    return this.dispositionService.getBatchDisposition(id, user);
  }
}