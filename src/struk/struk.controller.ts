import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { uuidParamPipe } from '../common/pipes/uuid-param.pipe.js';
import type { AuthenticatedUser } from '../common/types.js';
import { StrukService } from './struk.service.js';
import type { StrukLinkDto } from './struk.mapper.js';

@Controller('batches')
export class StrukController {
  constructor(private readonly strukService: StrukService) {}

  @Post(':id/struk-link')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  @HttpCode(HttpStatus.OK)
  async mintLink(
    @Param('id', uuidParamPipe('id')) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<StrukLinkDto> {
    return this.strukService.mintLink(id, actor);
  }
}