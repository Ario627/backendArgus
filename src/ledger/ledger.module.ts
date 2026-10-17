import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcceptanceProfile } from '../database/entities/acceptance-profile.entity.js';
import { Batch } from '../database/entities/batch.entity.js';
import { LedgerEvent } from '../database/entities/ledger-event.entity.js';
import { User } from '../database/entities/user.entity.js';
import { ParameterModule } from '../parameter/parameter.module.js';
import { LedgerController } from './ledger.controller.js';
import { LedgerEntryService } from './ledger-entry.service.js';
import { LedgerService } from './ledger.service.js';
import { LedgerVerifyService } from './ledger-verify.service.js';
import { TransferService } from './transfer.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerEvent, Batch, User, AcceptanceProfile]),
    ParameterModule,
  ],
  controllers: [LedgerController],
  providers: [LedgerService, LedgerEntryService, TransferService, LedgerVerifyService],
  exports: [LedgerService, LedgerEntryService],
})
export class LedgerModule {}