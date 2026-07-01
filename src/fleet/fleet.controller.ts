import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { FleetService } from './fleet.service';
import { CreateFleetDto } from './dto/create-fleet.dto';
import { UpdateFleetDto } from './dto/update-fleet.dto';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Get()
  @Roles('admin', 'supervisor')
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.fleetService.findAll(parseInt(page, 10), parseInt(limit, 10));
  }

  @Get(':id')
  @Roles('admin', 'supervisor')
  findOne(@Param('id') id: string) {
    return this.fleetService.findOne(id);
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateFleetDto) {
    return this.fleetService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateFleetDto) {
    return this.fleetService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.fleetService.softDelete(id);
  }

  @Post(':id/revoke-device')
  @Roles('admin')
  revokeDevice(@Param('id') id: string) {
    return this.fleetService.revokeDevice(id);
  }
}