import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParameterKalibrasi } from '../database/entities/parameter-kalibrasi.entity.js';
import { ParameterController } from './parameter.controller.js';
import { ParameterService } from './parameter.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ParameterKalibrasi])],
  controllers: [ParameterController],
  providers: [ParameterService],
  exports: [ParameterService],
})
export class ParameterModule {}
