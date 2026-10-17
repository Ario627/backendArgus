import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { BatchStatus } from '../common/constant/domain.constant.js';
import { BATCH_STATUS_TRANSITIONS } from '../common/constant/transitions.constant.js';
import type { ApiErrorDetail, AuthenticatedUser } from '../common/types.js';
import { Batch } from '../database/entities/batch.entity.js';
import { LedgerEvent } from '../database/entities/ledger-event.entity.js';
import type { AppendEventDto } from './dto/append-event.dto.js';
import {
  ledgerCorrectionInvalidError,
  ledgerEventRoleForbiddenError,
  ledgerSideRequiredError,
  ledgerTimeInFutureError,
} from './ledger.errors.js';
import {
  canAppendLedgerEvent,
  deriveTransferSide,
  type TransferSide,
} from './ledger-permission.util.js';
import type { LedgerEventData } from './ledger-payload.util.js';
import { LedgerService } from './ledger.service.js';

const MAX_FUTURE_SKEW_MS = 300000;
const MIN_CORRECTION_NOTE_LENGTH = 10;

const ADVANCE_TARGET: Readonly<Partial<Record<string, BatchStatus>>> = Object.freeze({
  DITERIMA: 'DITERIMA',
  DIOLAH: 'DIOLAH',
  KELUARAN: 'SELESAI',
});

export interface AppendEventResult {
  readonly event: LedgerEvent;
  readonly duplicate: boolean;
}

@Injectable()
export class LedgerEntryService {
  constructor(
    @InjectRepository(Batch) private readonly batchRepository: Repository<Batch>,
    private readonly ledgerService: LedgerService,
  ) {}

  async appendEvent(
    batchId: string,
    dto: AppendEventDto,
    actor: AuthenticatedUser,
  ): Promise<AppendEventResult> {
    if (!canAppendLedgerEvent(actor.role, dto.tipe)) {
      throw ledgerEventRoleForbiddenError(dto.tipe);
    }
    if (dto.tipe === 'KOREKSI') {
      this.assertCorrectionComplete(dto);
    }

    const occurredAt = new Date(dto.occurredAt);
    if (occurredAt.getTime() > Date.now() + MAX_FUTURE_SKEW_MS) {
      throw ledgerTimeInFutureError();
    }

    const data = this.buildPayloadData(dto, actor);

    return this.batchRepository.manager.transaction(async (manager) => {
      const result = await this.ledgerService.appendWithinTransaction(manager, {
        batchId,
        tipe: dto.tipe,
        actorId: actor.id,
        weightKg: dto.weightKg ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        photoHash: dto.photoHash ?? null,
        occurredAt,
        catatan: dto.note ?? null,
        data,
        clientEventId: dto.clientEventId,
      });
      if (!result.duplicate) {
        await this.advanceBatchStatus(manager, batchId, dto.tipe);
      }
      return result;
    });
  }

  private assertCorrectionComplete(dto: AppendEventDto): void {
    const details: ApiErrorDetail[] = [];
    if (dto.note === undefined || dto.note.trim().length < MIN_CORRECTION_NOTE_LENGTH) {
      details.push({ code: 'NOTE_TOO_SHORT', field: 'note' });
    }
    if (dto.refEventId === undefined) {
      details.push({ code: 'REF_EVENT_REQUIRED', field: 'refEventId' });
    }
    if (details.length > 0) throw ledgerCorrectionInvalidError(details);
  }

  private buildPayloadData(dto: AppendEventDto, actor: AuthenticatedUser): LedgerEventData | null {
    if (dto.tipe === 'SERAH_TERIMA') {
      const side = this.resolveSide(dto, actor);
      return { sisi: side };
    }
    if (dto.tipe === 'KOREKSI') {
      return { refEventId: dto.refEventId ?? null };
    }
    return null;
  }

  private resolveSide(dto: AppendEventDto, actor: AuthenticatedUser): TransferSide {
    const side = deriveTransferSide(actor.role, dto.sisi);
    if (side === null) throw ledgerSideRequiredError();
    return side;
  }

  private async advanceBatchStatus(
    manager: EntityManager,
    batchId: string,
    tipe: string,
  ): Promise<void> {
    const target = ADVANCE_TARGET[tipe];
    if (target === undefined) return;
    const batch = await manager.findOne(Batch, { where: { id: batchId } });
    if (batch === null || batch.status === target) return;
    if (!BATCH_STATUS_TRANSITIONS[batch.status].includes(target)) return;
    await manager.query('UPDATE batch SET status = $2 WHERE id = $1', [batchId, target]);
  }
}