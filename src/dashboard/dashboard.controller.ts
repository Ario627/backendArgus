import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type { AuthenticatedUser } from '../common/types.js';
import { DashboardService, type DashboardSummary } from './dashboard.service.js';
import { DashboardSummaryQueryDto } from './dto/dashboard-query.dto.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardSummaryQueryDto,
  ): Promise<DashboardSummary> {
    if (user.role === 'sppg_staff') {
      if (user.sppgId === null) throw forbiddenActionError();
      return this.dashboardService.summary(user.sppgId);
    }
    return this.dashboardService.summary(query.sppgId ?? null);
  }
}