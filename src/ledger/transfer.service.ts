import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/types.js';
import type { LedgerEvent } from '../database/entities/ledger-event.entity.js';
import { ParameterService } from '../parameter/parameter.service.js';
import type { TransferConfirmDto } from './dto/transfer-confirm.dto.js';
import { LedgerEntryService } from './ledger-entry.service.js';
import { toLedgerEventDto, type LedgerEventDto } from './ledger.mapper.js';
import { LedgerService } from './ledger.service.js';
import { evaluateTransfer, extractTransferWitnesses, type TransferEvaluation } from './transfer.util.js';

export interface TransferConfirmResult {
  readonly event: LedgerEventDto;
  readonly duplicate: boolean;
  readonly transfer: TransferEvaluation;
}

@Injectable()
export class TransferService {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly entryService: LedgerEntryService,
    private readonly parameterService: ParameterService,
  ) {}

  async confirm(
    batchId: string,
    dto: TransferConfirmDto,
    actor: AuthenticatedUser,
  ): Promise<TransferConfirmResult> {
    const result = await this.entryService.appendEvent(
      batchId,
      {
        clientEventId: dto.clientEventId,
        tipe: 'SERAH_TERIMA',
        weightKg: dto.weightKg,
        occurredAt: dto.occurredAt,
        lat: dto.lat,
        lng: dto.lng,
        photoHash: dto.photoHash,
        note: dto.note,
      },
      actor,
    );
    const rows = await this.ledgerService.listByBatch(batchId);
    const transfer = await this.evaluate(rows);
    return { event: toLedgerEventDto(result.event), duplicate: result.duplicate, transfer };
  }

  async evaluate(rows: readonly LedgerEvent[]): Promise<TransferEvaluation> {
    const tolerance = await this.parameterService.getValue('toleransi_neraca');
    return evaluateTransfer(extractTransferWitnesses(rows), tolerance?.nilai ?? null);
  }
}