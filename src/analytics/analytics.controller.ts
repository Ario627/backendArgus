import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../common/types.js';
import type { AppConfiguration } from '../config/configuration.js';
import {
  DigitScanService,
  type DigitScanResult,
} from './digit-scan.service.js';
import { DigitScanDto } from './dto/digit-scan.dto.js';

@Controller('anomalies')
export class AnalyticsController {
  private readonly config: AppConfiguration;

  constructor(
    configService: ConfigService,
    private readonly digitScanService: DigitScanService,
  ) {
    this.config = configService.getOrThrow<AppConfiguration>('app');
  }

  @Post('digit-scan')
  @Roles('admin', 'dlh_auditor')
  @HttpCode(HttpStatus.OK)
  async digitScan(
    @Body() dto: DigitScanDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<DigitScanResult> {
    return this.digitScanService.scan(dto, actor.id, this.config);
  }
}