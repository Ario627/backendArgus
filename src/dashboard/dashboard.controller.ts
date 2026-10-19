import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type { AuthenticatedUser } from '../common/types.js';
import type { NarrativeView } from '../llm/llm.types.js';
import { NarrativeService } from '../llm/narrative.service.js';
import {
  DashboardService,
  type DashboardSummary,
} from './dashboard.service.js';
import { DashboardSummaryQueryDto } from './dto/dashboard-query.dto.js';
import { NarrativeQueryDto } from './dto/narrative-query.dto.js';
import type { DashboardImpactDto } from './impact.dto.js';

const NARRATIVE_LIMIT = 20;
const NARRATIVE_WINDOW_MS = 60000;

const resolveScope = (
  user: AuthenticatedUser,
  requested: string | undefined,
): string | null => {
  if (user.role === 'sppg_staff') {
    if (user.sppgId === null) throw forbiddenActionError();
    return user.sppgId;
  }
  return requested ?? null;
};

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly narrativeService: NarrativeService,
  ) {}

  @Get('summary')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardSummaryQueryDto,
  ): Promise<DashboardSummary> {
    return this.dashboardService.summary(resolveScope(user, query.sppgId));
  }

  @Get('impact')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  async impact(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardSummaryQueryDto,
  ): Promise<DashboardImpactDto> {
    return this.dashboardService.impact(resolveScope(user, query.sppgId));
  }

  @Get('narrative')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  @Throttle({ default: { limit: NARRATIVE_LIMIT, ttl: NARRATIVE_WINDOW_MS } })
  async narrative(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NarrativeQueryDto,
  ): Promise<NarrativeView> {
    const scope = resolveScope(user, query.sppgId);
    const facts = await this.dashboardService.narrativeFacts(scope);
    const refresh = query.refresh === true && user.role === 'admin';
    return this.narrativeService.request(facts, user, refresh, scope);
  }
}
