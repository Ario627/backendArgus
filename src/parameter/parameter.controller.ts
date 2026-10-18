import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../common/types.js';
import { UpdateParameterDto } from './dto/update-parameter.dto.js';
import type { ParameterDto } from './parameter.mapper.js';
import { ParameterService } from './parameter.service.js';

@Controller('parameters')
export class ParameterController {
  constructor(private readonly parameterService: ParameterService) {}

  @Get()
  @Roles('admin', 'dlh_auditor')
  async list(): Promise<readonly ParameterDto[]> {
    return this.parameterService.listAll();
  }

  @Put(':kunci')
  @Roles('admin')
  async update(
    @Param('kunci') kunci: string,
    @Body() dto: UpdateParameterDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ParameterDto> {
    return this.parameterService.update(kunci, dto, actor.id);
  }
}