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
import { DeviceService } from './device.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { AssignDeviceDto } from './dto/assign-device.dto';
import { GenerateTokenDto, ProvisionDto } from './dto/provision.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { DeviceStatus } from 'src/database/entities/device.entity';

@Controller('device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  @Roles('admin', 'supervisor')
  findAll(@Query('status') status?: DeviceStatus) {
    return this.deviceService.findAll(
      status ? (status as DeviceStatus) : undefined,
    );
  }

  @Get('unassigned')
  @Roles('admin', 'supervisor')
  findUnassigned() {
    return this.deviceService.findUnassigned();
  }

  @Get(':deviceId')
  @Roles('admin', 'supervisor')
  findOne(@Param('deviceId') deviceId: string) {
    return this.deviceService.findByDeviceId(deviceId);
  }

  @Post('register')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDeviceDto) {
    return this.deviceService.register(dto);
  }

  @Post(':deviceId/revoke')
  @Roles('admin')
  revoke(@Param('deviceId') deviceId: string) {
    return this.deviceService.revoke(deviceId);
  }

  @Post('fleet/:fleetId/assign')
  @Roles('admin')
  assignToFleet(
    @Param('fleetId') fleetId: string,
    @Body() dto: AssignDeviceDto,
  ) {
    return this.deviceService.assignToFleet(fleetId, dto);
  }

  @Post('provisioning-token/generate')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  generateToken(@Body() dto: GenerateTokenDto) {
    return this.deviceService.generateProvisioningToken(dto);
  }

  @Post('provision')
  @HttpCode(HttpStatus.OK)
  provision(@Body() dto: ProvisionDto) {
    return this.deviceService.provisionWithToken(dto.token);
  }
}