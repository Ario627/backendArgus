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
import { LinkScaleDto } from './dto/link-scale.dto.js';
import { ScalePendingQueryDto } from './dto/scale-pending-query.dto.js';
import type { ScaleLinkResultDto, ScalePendingDto } from './scale.mapper.js';
import { ScalePendingService } from './scale-pending.service.js';

@Controller('scale')
export class ScaleController {
  constructor(private readonly pendingService: ScalePendingService) {}

  @Get('pending')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  async listPending(
    @Query() query: ScalePendingQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PaginatedItems<ScalePendingDto>> {
    return this.pendingService.list(query, actor);
  }

  @Get('pending/:id')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  async detailPending(
    @Param('id', uuidParamPipe('id')) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ScalePendingDto> {
    return this.pendingService.getDetail(id, actor);
  }

  @Post('pending/:id/link')
  @Roles('admin', 'sppg_staff')
  @HttpCode(HttpStatus.OK)
  async link(
    @Param('id', uuidParamPipe('id')) id: string,
    @Body() dto: LinkScaleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ScaleLinkResultDto> {
    return this.pendingService.link(id, dto, actor);
  }
}