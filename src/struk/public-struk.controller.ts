import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator.js';
import { StrukService } from './struk.service.js';
import type { PublicStrukDto } from './struk.mapper.js';

const STRUK_VIEW_LIMIT = 60;
const STRUK_VIEW_WINDOW_MS = 60000;

@Controller('public/struk')
export class PublicStrukController {
  constructor(private readonly strukService: StrukService) {}

  @Get(':token')
  @Public()
  @Throttle({ default: { limit: STRUK_VIEW_LIMIT, ttl: STRUK_VIEW_WINDOW_MS } })
  async view(@Param('token') token: string): Promise<PublicStrukDto> {
    return this.strukService.buildPublicStruk(token);
  }
}