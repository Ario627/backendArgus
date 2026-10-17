import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  IsNull,
  Repository,
  type EntityManager,
  type FindOptionsWhere,
} from 'typeorm';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import { DEFAULT_PAGE_SIZE } from '../common/dto/list-query.dto.js';
import { generateId } from '../common/utils/id.util.js';
import type { AppConfiguration } from '../config/configuration.js';
import { Batch } from '../database/entities/batch.entity.js';
import { ScalePending } from '../database/entities/scale-pending.entity.js';
import { batchNotFoundError } from '../batch/batch.errors.js';
import type { AppendLedgerResult } from '../ledger/ledger.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { deriveScaleEventUuid } from './scale-payload.util.js';
import {
  scaleLinkBatchMismatchError,
  scalePendingClosedError,
  scalePendingNotFoundError,
} from './scale.errors.js';
import type { LinkScaleDto } from './dto/link-scale.dto.js';
import type { ScalePendingQueryDto } from './dto/scale-pending-query.dto.js';
import {
  toScaleLinkResultDto,
  toScalePendingDto,
  type ScaleLinkResultDto,
  type ScalePendingDto,
} from './scale.mapper.js';

const ENQUEUE_SQL = `
INSERT INTO penimbangan_menunggu (id, device_id, sppg_id, berat_kg, occurred_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (device_id, occurred_at) DO NOTHING`;

const LINK_SQL = `
WITH linked AS (
  UPDATE penimbangan_menunggu
     SET dipakai_batch_id = $2,
         ditautkan_at = now(),
         ditautkan_oleh = $3
   WHERE id = $1
     AND ditautkan_at IS NULL
     AND diarsipkan_at IS NULL
  RETURNING id
)
SELECT id FROM linked`;

const ARCHIVE_SQL = `
WITH archived AS (
  UPDATE penimbangan_menunggu
     SET diarsipkan_at = now()
   WHERE ditautkan_at IS NULL
     AND diarsipkan_at IS NULL
     AND received_at < now() - make_interval(hours => $1)
  RETURNING id
)
SELECT id FROM archived`;

export interface DeviceWeighingInput {
  readonly deviceId: string;
  readonly sppgId: string;
  readonly weightKg: number;
  readonly occurredAtRaw: string;
  readonly occurredAt: Date;
}

interface IdRow {
  readonly id: string;
}

@Injectable()
export class ScalePendingService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ScalePendingService.name);
  private readonly maxAgeMs: number;
  private readonly sweepIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    configService: ConfigService,
    @InjectRepository(ScalePending)
    private readonly pendingRepository: Repository<ScalePending>,
    @InjectRepository(Batch)
    private readonly batchRepository: Repository<Batch>,
    private readonly ledgerService: LedgerService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.maxAgeMs = config.device.pendingMaxAgeHours * 3600000;
    this.sweepIntervalMs = config.device.sweepIntervalSeconds * 1000;
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      void this.sweep();
    }, this.sweepIntervalMs);
    void this.sweep();
  }

  onApplicationShutdown(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const archived = await this.pendingRepository.manager.query<IdRow[]>(
        ARCHIVE_SQL,
        [this.maxAgeMs / 3600000],
      );
      if (archived.length > 0) {
        this.logger.log(`arsip penimbangan menunggu: ${archived.length} baris`);
      }
    } catch (error) {
      this.logger.error(
        'penyapuan arsip penimbangan gagal',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  private resolveScope(
    query: ScalePendingQueryDto,
    actor: AuthenticatedUser,
  ): string | null {
    if (actor.role === 'sppg_staff') {
      if (actor.sppgId === null) throw forbiddenActionError();
      if (query.sppgId !== undefined && query.sppgId !== actor.sppgId) {
        throw forbiddenActionError();
      }
      return actor.sppgId;
    }
    return query.sppgId ?? null;
  }

  private assertScope(actor: AuthenticatedUser, sppgId: string): void {
    if (actor.role === 'sppg_staff' && actor.sppgId !== sppgId) {
      throw forbiddenActionError();
    }
  }

  private async requireOpenPending(id: string): Promise<ScalePending> {
    const pending = await this.pendingRepository.findOne({ where: { id } });
    if (pending === null) throw scalePendingNotFoundError();
    if (pending.ditautkanAt !== null || pending.diarsipkanAt !== null) {
      throw scalePendingClosedError();
    }
    return pending;
  }

  async enqueueWithin(
    manager: EntityManager,
    input: DeviceWeighingInput,
  ): Promise<void> {
    await manager.query(ENQUEUE_SQL, [
      generateId(),
      input.deviceId,
      input.sppgId,
      input.weightKg,
      input.occurredAt,
    ]);
  }

  async appendDeviceWeighingWithin(
    manager: EntityManager,
    batchId: string,
    input: DeviceWeighingInput,
  ): Promise<AppendLedgerResult> {
    return this.ledgerService.appendWithinTransaction(manager, {
      batchId,
      tipe: 'DITIMBANG',
      actorId: null,
      deviceId: input.deviceId,
      weightKg: input.weightKg,
      occurredAt: input.occurredAt,
      data: { origin: 'DEVICE', weighingId: null },
      clientEventId: deriveScaleEventUuid(
        input.deviceId,
        input.weightKg,
        input.occurredAtRaw,
      ),
    });
  }

  async getDetail(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<ScalePendingDto> {
    const pending = await this.pendingRepository.findOne({ where: { id } });
    if (pending === null) throw scalePendingNotFoundError();
    this.assertScope(actor, pending.sppgId);
    return toScalePendingDto(pending, Date.now(), this.maxAgeMs);
  }

  async list(
    query: ScalePendingQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedItems<ScalePendingDto>> {
    const scope = this.resolveScope(query, actor);
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: FindOptionsWhere<ScalePending> = {
      ditautkanAt: IsNull(),
      diarsipkanAt: IsNull(),
    };
    if (scope !== null) where.sppgId = scope;
    const [rows, total] = await this.pendingRepository.findAndCount({
      where,
      order: { receivedAt: 'DESC', id: 'ASC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    const nowMs = Date.now();
    return {
      items: rows.map((row) => toScalePendingDto(row, nowMs, this.maxAgeMs)),
      nextCursor: null,
      total,
    };
  }

  async link(
    id: string,
    dto: LinkScaleDto,
    actor: AuthenticatedUser,
  ): Promise<ScaleLinkResultDto> {
    const pending = await this.requireOpenPending(id);
    this.assertScope(actor, pending.sppgId);
    const batch = await this.batchRepository.findOne({
      where: { id: dto.batchId },
    });
    if (batch === null) throw batchNotFoundError();
    if (batch.sppgId !== pending.sppgId) throw scaleLinkBatchMismatchError();

    const occurredAtRaw = pending.occurredAt.toISOString();
    const appended = await this.pendingRepository.manager.transaction(
      async (manager) => {
        const result = await this.ledgerService.appendWithinTransaction(
          manager,
          {
            batchId: batch.id,
            tipe: 'DITIMBANG',
            actorId: actor.id,
            deviceId: pending.deviceId,
            weightKg: pending.beratKg,
            occurredAt: pending.occurredAt,
            data: { origin: 'DEVICE', weighingId: pending.id },
            clientEventId: deriveScaleEventUuid(
              pending.deviceId,
              pending.beratKg,
              occurredAtRaw,
            ),
          },
        );
        const updated = await manager.query<IdRow[]>(LINK_SQL, [
          pending.id,
          batch.id,
          actor.id,
        ]);
        if (updated.length === 0) throw scalePendingClosedError();
        return result;
      },
    );

    const finalRow = await this.pendingRepository.findOneOrFail({
      where: { id: pending.id },
    });
    return toScaleLinkResultDto(finalRow, appended, Date.now(), this.maxAgeMs);
  }
}
