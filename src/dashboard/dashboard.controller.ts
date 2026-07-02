import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/common/types';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('fleet-positions')
  @Roles('admin', 'supervisor')
  async getFleetPositions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.dashboardService.getFleetPositions(page ?? 1, limit ?? 50);
  }

  @Get('fleet-positions/mine')
  @Roles('driver')
  async getMyFleetPosition(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getFleetPositions(
      1,
      1,
      user.fleetId ?? undefined,
    );
  }

  @Get('summary')
  @Roles('admin', 'supervisor')
  async getSummary() {
    return this.dashboardService.getSummary();
  }
}