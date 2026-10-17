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
import type { PaginatedItems, AuthenticatedUser } from '../common/types.js';
import { uuidParamPipe } from '../common/pipes/uuid-param.pipe.js';
import { CreatePointDto } from './dto/create-point.dto.js';
import { CreateSppgDto } from './dto/create-sppg.dto.js';
import { SppgListQueryDto } from './dto/list-query.dto.js';
import { UpdatePointDto } from './dto/update-point.dto.js';
import { UpdateSppgDto } from './dto/update-sppg.dto.js';
import type { PointDto, SppgDetailDto, SppgDto } from './sppg.mapper.js';
import { SppgService } from './sppg.service.js';

@Controller('sppg')
export class SppgController {
  constructor(private readonly sppgService: SppgService) {}

  @Get()
  @Roles('admin', 'dlh_auditor')
  list(@Query() query: SppgListQueryDto): Promise<PaginatedItems<SppgDto>> {
    return this.sppgService.list(query);
  }

  @Get(':id')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  detail(
    @Param('id', uuidParamPipe('id')) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SppgDetailDto> {
    return this.sppgService.getDetail(id, user);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateSppgDto): Promise<SppgDto> {
    return this.sppgService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id', uuidParamPipe('id')) id: string,
    @Body() dto: UpdateSppgDto,
  ): Promise<SppgDto> {
    return this.sppgService.update(id, dto);
  }

  @Post(':id/points')
  @Roles('admin')
  createPoint(
    @Param('id', uuidParamPipe('id')) id: string,
    @Body() dto: CreatePointDto,
  ): Promise<PointDto> {
    return this.sppgService.createPoint(id, dto);
  }

  @Patch(':id/points/:pointId')
  @Roles('admin')
  updatePoint(
    @Param('id', uuidParamPipe('id')) id: string,
    @Param('pointId', uuidParamPipe('pointId')) pointId: string,
    @Body() dto: UpdatePointDto,
  ): Promise<PointDto> {
    return this.sppgService.updatePoint(id, pointId, dto);
  }
}
