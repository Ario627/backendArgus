import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { LedgerEventType } from '../common/constant/domain.constant.js';
import { isLedgerEventAllowed } from '../common/constant/transitions.constant.js';
import { hitungHash } from '../common/utils/hash.util.js';
import { Batch } from '../database/entities/batch.entity.js';
import { LedgerEvent } from '../database/entities/ledger-event.entity.js';
import { ledgerSequenceError, ledgerWeightRequiredError } from './ledger.errors.js';
import { buildLedgerPayload, type LedgerEventData } from './ledger-payload.util.js';

const WEIGHT_REQUIRED_EVENTS: ReadonlySet<LedgerEventType> = new Set([
  'DITIMBANG',
  'SERAH_TERIMA',
  'DITERIMA',
  'KELUARAN',
]);

export interface AppendLedgerEventInput {
  readonly batchId: string;
  readonly tipe: LedgerEventType;
  readonly actorId: string | null;
  readonly deviceId?: string | null;
  readonly weightKg?: number | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly photoHash?: string | null;
  readonly occurredAt: Date;
  readonly catatan?: string | null;
  readonly data?: LedgerEventData | null;
  readonly clientEventId?: string | null;
}

export interface AppendLedgerResult {
  readonly event: LedgerEvent;
  readonly duplicate: boolean;
}

const findByClientEventId = async (
  manager: EntityManager,
  clientEventId: string,
): Promise<LedgerEvent | null> =>
  manager.findOne(LedgerEvent, { where: { clientEventId } });

const findLastEvent = async (manager: EntityManager, batchId: string): Promise<LedgerEvent | null> =>
  manager.findOne(LedgerEvent, { where: { batchId }, order: { id: 'DESC' } });

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEvent) private readonly ledgerRepository: Repository<LedgerEvent>,
  ) {}

  async append(input: AppendLedgerEventInput): Promise<AppendLedgerResult> {
    const manager = this.ledgerRepository.manager;
    return manager.transaction((transactionManager) =>
      this.appendWithinTransaction(transactionManager, input),
    );
  }

  async appendWithinTransaction(
    manager: EntityManager,
    input: AppendLedgerEventInput,
  ): Promise<AppendLedgerResult> {
    const clientEventId = input.clientEventId ?? null;
    if (clientEventId !== null) {
      const existing = await findByClientEventId(manager, clientEventId);
      if (existing !== null) return { event: existing, duplicate: true };
    }

    const batch = await manager.findOne(Batch, {
      where: { id: input.batchId },
      lock: { mode: 'pessimistic_write' },
    });
    if (batch === null) {
      throw ledgerSequenceError();
    }
    if (!isLedgerEventAllowed(batch.status, input.tipe)) {
      throw ledgerSequenceError();
    }

    const weightKg = input.weightKg ?? null;
    if (WEIGHT_REQUIRED_EVENTS.has(input.tipe) && weightKg === null) {
      throw ledgerWeightRequiredError();
    }

    const payload = buildLedgerPayload({
      batchId: batch.id,
      tipe: input.tipe,
      beratKg: weightKg,
      aktor: input.actorId,
      deviceId: input.deviceId ?? null,
      fotoHash: input.photoHash ?? null,
      waktuKejadian: input.occurredAt,
      catatan: input.catatan ?? null,
      data: input.data ?? null,
      clientEventId,
    });

    const previous = await findLastEvent(manager, batch.id);
    const prevHash = previous?.hash ?? null;
    const hash = hitungHash(prevHash, payload);

    const insertedRows = (await manager.query(
      `INSERT INTO ledger_event
         (batch_id, tipe, aktor, device_id, berat_kg, lat, lng, foto_hash, waktu_kejadian, payload, prev_hash, hash, client_event_id, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14)
       ON CONFLICT (client_event_id) DO NOTHING
       RETURNING id`,
      [
        batch.id,
        input.tipe,
        input.actorId,
        input.deviceId ?? null,
        weightKg,
        input.lat ?? null,
        input.lng ?? null,
        input.photoHash ?? null,
        input.occurredAt,
        JSON.stringify(payload),
        prevHash,
        hash,
        clientEventId,
        batch.isDemo,
      ],
    )) as { id: string }[];

    const insertedId = insertedRows[0]?.id;
    if (insertedId === undefined) {
      if (clientEventId === null) {
        throw new Error('LEDGER_INSERT_TIDAK_TERSIMPAN');
      }
      const raced = await findByClientEventId(manager, clientEventId);
      if (raced === null) {
        throw new Error('LEDGER_INSERT_TIDAK_TERSIMPAN');
      }
      return { event: raced, duplicate: true };
    }

    const event = await manager.findOneOrFail(LedgerEvent, { where: { id: Number(insertedId) } });
    return { event, duplicate: false };
  }

  async listByBatch(batchId: string): Promise<readonly LedgerEvent[]> {
    return this.ledgerRepository.find({ where: { batchId }, order: { id: 'ASC' } });
  }

  async listByBatchWithin(manager: EntityManager, batchId: string): Promise<readonly LedgerEvent[]> {
    return manager.find(LedgerEvent, { where: { batchId }, order: { id: 'ASC' } });
  }
}