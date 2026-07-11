import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { OptimizationService } from './optimization.service';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('optimization')
export class OptimizationController {
  constructor(private readonly optimizationService: OptimizationService) {}

  @Post('trigger')
  @Roles('admin', 'supervisor')
  @HttpCode(HttpStatus.OK)
  triggerDailyPlan() {
    return this.optimizationService.buildDailyPlan();
  }
}