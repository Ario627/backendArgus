import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { uuidParamPipe } from '../common/pipes/uuid-param.pipe.js';
import type { AuthenticatedUser } from '../common/types.js';
import { AppendEventDto } from './dto/append-event.dto.js';
import { TransferConfirmDto } from './dto/transfer-confirm.dto.js';
import { LedgerEntryService } from './ledger-entry.service.js';
import { toLedgerEventDto, type LedgerEventDto } from './ledger.mapper.js';
import { LedgerVerifyService, type LedgerListReport } from './ledger-verify.service.js';
import type { VerificationReport } from './ledger-verify.types.js';
import { TransferService, type TransferConfirmResult } from './transfer.service.js';

export interface AppendEventResultDto {
  readonly event: LedgerEventDto;
  readonly duplicate: boolean;
}

export interface RecentEventsDto {
  readonly items: readonly LedgerEventDto[];
}

@Controller('ledger')
export class LedgerController {
  constructor(
    private readonly entryService: LedgerEntryService,
    private readonly transferService: TransferService,
    private readonly verifyService: LedgerVerifyService,
  ) {}

  @Get('recent')
  @Roles('dlh_auditor', 'admin')
  async recent(): Promise<RecentEventsDto> {
    return { items: await this.verifyService.recentEvents() };
  }

  @Get(':batchId')
  list(
    @Param('batchId', uuidParamPipe('batchId')) batchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LedgerListReport> {
    return this.verifyService.listEvents(batchId, user);
  }

  @Post(':batchId/events')
  @HttpCode(HttpStatus.CREATED)
  @Roles('sppg_staff', 'driver', 'facility', 'admin')
  async append(
    @Param('batchId', uuidParamPipe('batchId')) batchId: string,
    @Body() dto: AppendEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AppendEventResultDto> {
    const result = await this.entryService.appendEvent(batchId, dto, user);
    return { event: toLedgerEventDto(result.event), duplicate: result.duplicate };
  }

  @Post(':batchId/transfer/confirm')
  @HttpCode(HttpStatus.OK)
  @Roles('sppg_staff', 'driver', 'facility', 'admin')
  confirm(
    @Param('batchId', uuidParamPipe('batchId')) batchId: string,
    @Body() dto: TransferConfirmDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransferConfirmResult> {
    return this.transferService.confirm(batchId, dto, user);
  }

  @Get(':batchId/verify')
  verify(
    @Param('batchId', uuidParamPipe('batchId')) batchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VerificationReport> {
    return this.verifyService.verify(batchId, user);
  }
}