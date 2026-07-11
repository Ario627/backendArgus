import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { FleetService, type FleetCsvRow } from './fleet.service';
import { CreateFleetDto } from './dto/create-fleet.dto';
import { UpdateFleetDto } from './dto/update-fleet.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RawResponse } from 'src/common/decorators/raw-response.decorator';

@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Get()
  @Roles('admin', 'supervisor')
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.fleetService.findAll(parseInt(page, 10), parseInt(limit, 10));
  }

  @Get('export/csv')
  @Roles('admin')
  @RawResponse()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="fleet-export.csv"')
  async exportCsv(): Promise<string> {
    const rows = await this.fleetService.exportCsv();
    return this.toCsv(rows);
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

  private toCsv(rows: FleetCsvRow[]): string {
    const headers = [
      'fleetId',
      'plateNumber',
      'driverName',
      'driverContact',
      'capacityKg',
      'deviceId',
      'statusHardware',
      'operationalStatus',
    ];

    const escape = (val: string | number): string => {
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(
        [
          escape(row.fleetId),
          escape(row.plateNumber),
          escape(row.driverName),
          escape(row.driverContact),
          escape(row.capacityKg),
          escape(row.deviceId),
          escape(row.statusHardware),
          escape(row.operationalStatus),
        ].join(','),
      );
    }

    return lines.join('\n');
  }
}