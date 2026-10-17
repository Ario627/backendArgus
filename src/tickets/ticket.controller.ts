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
import { RespondTicketDto } from './dto/respond-ticket.dto.js';
import { TicketListQueryDto } from './dto/ticket-list-query.dto.js';
import { TicketNoteDto } from './dto/ticket-note.dto.js';
import { VerifyTicketDto } from './dto/verify-ticket.dto.js';
import type { TicketDetailDto, TicketDto } from './ticket.mapper.js';
import { TicketService } from './ticket.service.js';

@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get()
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  async list(
    @Query() query: TicketListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PaginatedItems<TicketDto>> {
    return this.ticketService.list(query, actor);
  }

  @Get(':id')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  async detail(
    @Param('id', uuidParamPipe('id')) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TicketDetailDto> {
    return this.ticketService.getDetail(id, actor);
  }

  @Post(':id/verify')
  @Roles('admin', 'dlh_auditor')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Param('id', uuidParamPipe('id')) id: string,
    @Body() dto: VerifyTicketDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TicketDetailDto> {
    return this.ticketService.verify(id, dto, actor);
  }

  @Post(':id/respond')
  @Roles('admin', 'sppg_staff')
  @HttpCode(HttpStatus.OK)
  async respond(
    @Param('id', uuidParamPipe('id')) id: string,
    @Body() dto: RespondTicketDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TicketDetailDto> {
    return this.ticketService.respond(id, dto, actor);
  }

  @Post(':id/close')
  @Roles('admin', 'dlh_auditor')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id', uuidParamPipe('id')) id: string,
    @Body() dto: TicketNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TicketDetailDto> {
    return this.ticketService.close(id, dto, actor);
  }
}