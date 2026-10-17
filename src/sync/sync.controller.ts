import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/types.js';
import { SyncBatchDto } from './dto/sync.dto.js';
import { SyncService, type SyncResultItem } from './sync.service.js';

export interface SyncResponseDto {
  readonly results: readonly SyncResultItem[];
}

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  async process(
    @Body() dto: SyncBatchDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SyncResponseDto> {
    const outcome = await this.syncService.process(dto, user);
    response.status(outcome.partiallyFailed ? HttpStatus.MULTI_STATUS : HttpStatus.OK);
    return { results: outcome.results };
  }
}