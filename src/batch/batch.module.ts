import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BatchFraction } from '../database/entities/batch-fraction.entity.js';
import { Batch } from '../database/entities/batch.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { DispatchModule } from '../dispatch/dispatch.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { BatchController } from './batch.controller.js';
import { BatchService } from './batch.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Batch, BatchFraction, Sppg]),
    LedgerModule,
    DispatchModule,
  ],
  controllers: [BatchController],
  providers: [BatchService],
  exports: [BatchService],
})
export class BatchModule {}
