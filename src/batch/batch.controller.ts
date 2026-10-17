import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { uuidParamPipe } from '../common/pipes/uuid-param.pipe.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import { BatchService, type CreateBatchResult } from './batch.service.js';
import type { BatchDetailDto, BatchDto } from './batch.mapper.js';
import { BatchListQueryDto } from './dto/batch-list-query.dto.js';
import { CreateBatchDto } from './dto/create-batch.dto.js';
import { ReGateBatchDto } from './dto/regate-batch.dto.js';

@Controller('batches')
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @Post()
  @Roles('sppg_staff', 'admin')
  create(
    @Body() dto: CreateBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreateBatchResult> {
    return this.batchService.create(dto, user);
  }

  @Get()
  list(
    @Query() query: BatchListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedItems<BatchDto>> {
    return this.batchService.list(query, user);
  }

  @Get(':id')
  detail(
    @Param('id', uuidParamPipe('id')) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchDetailDto> {
    return this.batchService.getDetail(id, user);
  }

  @Post(':id/gate')
  @HttpCode(HttpStatus.OK)
  @Roles('sppg_staff', 'admin')
  reGate(
    @Param('id', uuidParamPipe('id')) id: string,
    @Body() dto: ReGateBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchDetailDto> {
    return this.batchService.reGate(id, dto, user);
  }
}