import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { RecoveryService } from './recovery.service';
import { RecoveryTriggerDto } from './dto/recovery-trigger.dto';
import { RecoveryAssignDto } from './dto/recovery-assign.dto';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('recovery')
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Post('trigger')
  @Roles('admin', 'supervisor', 'driver')
  @HttpCode(HttpStatus.OK)
  trigger(@Body() dto: RecoveryTriggerDto) {
    return this.recoveryService.trigger(dto.brokenFleetId, dto.manual ?? false);
  }

  @Post('assign')
  @Roles('admin', 'supervisor')
  @HttpCode(HttpStatus.OK)
  assign(@Body() dto: RecoveryAssignDto) {
    return this.recoveryService.assign(
      dto.brokenFleetId,
      dto.receivingFleetIds,
      dto.redistributedStopIds,
    );
  }

  @Get(':id')
  @Roles('admin', 'supervisor')
  getResult(@Param('id') id: string) {
    return this.recoveryService.getResult(id);
  }
}