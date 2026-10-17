import { Module } from '@nestjs/common';
import { BatchModule } from '../batch/batch.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { MenuModule } from '../menu/menu.module.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [BatchModule, LedgerModule, MenuModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
