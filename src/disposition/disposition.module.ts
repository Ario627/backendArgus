import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcceptanceProfile } from '../database/entities/acceptance-profile.entity.js';
import { BatchFraction } from '../database/entities/batch-fraction.entity.js';
import { Batch } from '../database/entities/batch.entity.js';
import { Facility } from '../database/entities/facility.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { ParameterModule } from '../parameter/parameter.module.js';
import { CandidateBuilder } from './candidate.builder.js';
import { BatchDispositionController, DispositionController } from './disposition.controller.js';
import { DispositionService } from './disposition.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Batch, BatchFraction, Sppg, Facility, AcceptanceProfile]),
    ParameterModule,
  ],
  controllers: [DispositionController, BatchDispositionController],
  providers: [DispositionService, CandidateBuilder],
})
export class DispositionModule {}