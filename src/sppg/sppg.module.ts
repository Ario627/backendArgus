import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistributionPoint } from '../database/entities/distribution-point.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { SppgController } from './sppg.controller.js';
import { SppgService } from './sppg.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Sppg, DistributionPoint])],
  controllers: [SppgController],
  providers: [SppgService],
})
export class SppgModule {}