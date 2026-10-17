import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { uuidParamPipe } from '../common/pipes/uuid-param.pipe.js';
import type { PaginatedItems } from '../common/types.js';
import { CreateDeviceDto } from './dto/create-device.dto.js';
import { DeviceListQueryDto } from './dto/device-list-query.dto.js';
import type { DeviceDto } from './device.mapper.js';
import { DeviceService, type DeviceCreated } from './device.service.js';

@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  @Roles('admin', 'dlh_auditor')
  async list(
    @Query() query: DeviceListQueryDto,
  ): Promise<PaginatedItems<DeviceDto>> {
    return this.deviceService.list(query);
  }

  @Get(':id')
  @Roles('admin', 'dlh_auditor')
  async detail(
    @Param('id', uuidParamPipe('id')) id: string,
  ): Promise<DeviceDto> {
    return this.deviceService.getDetail(id);
  }

  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateDeviceDto): Promise<DeviceCreated> {
    return this.deviceService.create(dto);
  }

  @Post(':id/revoke')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async revoke(@Param('id', uuidParamPipe('id')) id: string): Promise<{
    device: DeviceDto;
    alreadyRevoked: boolean;
  }> {
    return this.deviceService.revoke(id);
  }

  @Post(':id/rotate-secret')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async rotateSecret(
    @Param('id', uuidParamPipe('id')) id: string,
  ): Promise<DeviceCreated> {
    return this.deviceService.rotateSecret(id);
  }
}