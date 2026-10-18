import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BatchFraction } from '../database/entities/batch-fraction.entity.js';
import { Batch } from '../database/entities/batch.entity.js';
import { LedgerEvent } from '../database/entities/ledger-event.entity.js';
import { PublicStrukController } from './public-struk.controller.js';
import { StrukController } from './struk.controller.js';
import { StrukService } from './struk.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Batch, BatchFraction, LedgerEvent])],
  controllers: [PublicStrukController, StrukController],
  providers: [StrukService],
})
export class StrukModule {}