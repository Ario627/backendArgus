import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  RetentionService,
  type RetentionRunReport,
} from './retention.service.js';

@Controller('retention')
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Post('run')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async run(): Promise<RetentionRunReport> {
    return this.retentionService.run();
  }
}