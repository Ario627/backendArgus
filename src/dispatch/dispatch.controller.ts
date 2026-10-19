import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../common/types.js';
import {
  DispatchService,
  type AutoDispatchResult,
  type DispatchAssignmentDto,
  type DispatchBoardDto,
} from './dispatch.service.js';
import { AssignBatchDto } from './dto/assign-batch.dto.js';

@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get('board')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  async board(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('sppgId') sppgId?: string,
  ): Promise<DispatchBoardDto> {
    return this.dispatchService.board(actor, sppgId);
  }

  @Post('assign')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'sppg_staff')
  async assign(
    @Body() dto: AssignBatchDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<DispatchAssignmentDto> {
    return this.dispatchService.assign(dto.batchId, dto.fleetId, actor, false);
  }

  @Post('auto')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'sppg_staff')
  async auto(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('sppgId') sppgId?: string,
  ): Promise<AutoDispatchResult> {
    return this.dispatchService.autoAssign(actor, sppgId);
  }
}
