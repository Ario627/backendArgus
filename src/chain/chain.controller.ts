import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  ChainVerifyService,
  type ChainSweepReport,
} from './chain-verify.service.js';

@Controller('chain')
export class ChainController {
  constructor(private readonly chainVerifyService: ChainVerifyService) {}

  @Post('verify')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async verify(): Promise<ChainSweepReport> {
    return this.chainVerifyService.sweep();
  }
}