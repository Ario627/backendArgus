import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { OpsModule } from '../ops/ops.module.js';
import { ChainController } from './chain.controller.js';
import { ChainVerifyService } from './chain-verify.service.js';

@Module({
  imports: [LedgerModule, AuditModule, OpsModule],
  controllers: [ChainController],
  providers: [ChainVerifyService],
})
export class ChainModule {}