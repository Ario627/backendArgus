import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../database/entities/device.entity.js';
import { Fleet } from '../database/entities/fleet.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { DeviceController } from './device.controller.js';
import { DeviceService } from './device.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Device, Fleet, Sppg])],
  controllers: [DeviceController],
  providers: [DeviceService],
  exports: [DeviceService],
})
export class DeviceModule {}