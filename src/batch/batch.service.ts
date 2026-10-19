import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  FRACTION_CODES,
  type FractionCode,
  type GateStatus,
} from '../common/constant/domain.constant.js';
import {
  assertTransition,
  BATCH_STATUS_TRANSITIONS,
} from '../common/constant/transitions.constant.js';
import type {
  AuthenticatedUser,
  ApiErrorDetail,
  PaginatedItems,
} from '../common/types.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import { generateId } from '../common/utils/id.util.js';
import { canReadBatch } from './batch-access.util.js';
import { BatchFraction } from '../database/entities/batch-fraction.entity.js';
import { Batch } from '../database/entities/batch.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { DispatchService } from '../dispatch/dispatch.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { toLedgerEventDto } from '../ledger/ledger.mapper.js';
import {
  batchFractionsInvalidError,
  batchIdConflictError,
  batchNotFoundError,
  batchTimeInFutureError,
  batchTimeTooOldError,
  batchWeightRangeError,
  gateNotRetryableError,
} from './batch.errors.js';
import {
  toBatchDto,
  type BatchDetailDto,
  type BatchDto,
} from './batch.mapper.js';
import type { BatchListQueryDto } from './dto/batch-list-query.dto.js';
import type { CreateBatchDto } from './dto/create-batch.dto.js';
import {
  parseBatchFractions,
  type FractionViolation,
} from './fraction.util.js';
import {
  DEFAULT_SAFE_PROFILE,
  evaluateGate,
  type GateResult,
} from './gate.service.js';

const BATCH_WEIGHT_MIN_KG = 0.1;
const BATCH_WEIGHT_MAX_KG = 500;
const MINYAK_WEIGHT_MAX_KG = 200;
const MAX_FUTURE_SKEW_MS = 300000;
const MAX_PAST_MS = 86400000;
const DEFAULT_LIST_LIMIT = 20;

type BatchStatusTarget = 'MENUNGGU_ANGKUT' | 'GAGAL_GATE' | 'TERSANGKUT';

const BATCH_STATUS_BY_GATE: Readonly<Record<GateStatus, BatchStatusTarget>> =
  Object.freeze({
    LOLOS: 'MENUNGGU_ANGKUT',
    PERBAIKI: 'GAGAL_GATE',
    ALIHKAN: 'MENUNGGU_ANGKUT',
    TOLAK: 'TERSANGKUT',
  });

export interface CreateBatchResult {
  readonly batch: BatchDetailDto;
  readonly duplicate: boolean;
}

const roundHours = (hours: number): number => Math.round(hours * 10) / 10;

const toFractionDetails = (
  violations: readonly FractionViolation[],
): readonly ApiErrorDetail[] =>
  violations.map((violation) => ({
    code: violation.code,
    field: violation.field,
  }));

const assertWeightRange = (aliran: string, weightKg: number): void => {
  const withinGeneralRange =
    weightKg >= BATCH_WEIGHT_MIN_KG && weightKg <= BATCH_WEIGHT_MAX_KG;
  if (!withinGeneralRange) {
    throw batchWeightRangeError();
  }
  if (aliran === 'minyak' && weightKg > MINYAK_WEIGHT_MAX_KG) {
    throw batchWeightRangeError([
      { code: 'MINYAK_WEIGHT_RANGE', field: 'weightKg' },
    ]);
  }
};

const assertOccurredAtWindow = (
  occurredAt: Date,
  serverNow: Date,
  allowOld: boolean,
): void => {
  if (occurredAt.getTime() > serverNow.getTime() + MAX_FUTURE_SKEW_MS) {
    throw batchTimeInFutureError();
  }
  if (!allowOld && occurredAt.getTime() < serverNow.getTime() - MAX_PAST_MS) {
    throw batchTimeTooOldError();
  }
};

const composeGateDetail = (
  result: GateResult,
  ageHours: number,
  evaluatedAt: Date,
): Record<string, unknown> => ({
  status: result.status,
  fixes: [...result.fixes],
  violations: result.violations.map((violation) => ({ ...violation })),
  notes: result.notes.map((note) => ({ ...note })),
  usedDefaultProfile: result.usedDefaultProfile,
  ageHours: roundHours(ageHours),
  evaluatedAt: evaluatedAt.toISOString(),
});

@Injectable()
export class BatchService {
  constructor(
    @InjectRepository(Batch)
    private readonly batchRepository: Repository<Batch>,
    @InjectRepository(BatchFraction)
    private readonly fractionRepository: Repository<BatchFraction>,
    @InjectRepository(Sppg) private readonly sppgRepository: Repository<Sppg>,
    private readonly ledgerService: LedgerService,
    private readonly dispatchService: DispatchService,
  ) {}

  async create(
    dto: CreateBatchDto,
    actor: AuthenticatedUser,
  ): Promise<CreateBatchResult> {
    const sppg = await this.sppgRepository.findOne({
      where: { id: dto.sppgId },
    });
    if (sppg === null) throw batchNotFoundError();
    if (actor.role === 'sppg_staff' && actor.sppgId !== sppg.id) {
      throw forbiddenActionError();
    }

    assertWeightRange(dto.aliran, dto.weightKg);
    const fractions = parseBatchFractions(dto.aliran, dto.fractions ?? {});
    if (!fractions.ok)
      throw batchFractionsInvalidError(toFractionDetails(fractions.violations));

    const occurredAt = new Date(dto.occurredAt);
    const serverNow = new Date();
    assertOccurredAtWindow(occurredAt, serverNow, actor.role === 'admin');

    const ageHours = Math.max(
      0,
      (serverNow.getTime() - occurredAt.getTime()) / 3600000,
    );
    const gate = evaluateGate({
      aliran: dto.aliran,
      weightKg: dto.weightKg,
      fractions: fractions.fractions,
      moistureProxy: dto.moistureProxy ?? null,
      visibleOil: dto.visibleOil ?? false,
      ageHours,
      queueKgToday: 0,
      profile: DEFAULT_SAFE_PROFILE,
      target: null,
    });
    const targetStatus = BATCH_STATUS_BY_GATE[gate.status];
    assertTransition('DICATAT', targetStatus, BATCH_STATUS_TRANSITIONS, {
      code: 'BATCH_GATE_STATUS_INVALID',
      message: 'Hasil gate tidak menghasilkan status batch yang sah',
    });

    const batchId = dto.id ?? generateId();
    const result = await this.batchRepository.manager.transaction(
      async (manager) => {
        const insertedId = await this.insertBatchRow(manager, {
          batchId,
          dto,
          sppgId: sppg.id,
          isDemo: sppg.isDemo,
          occurredAt,
          serverNow,
        });
        if (insertedId === null) {
          const existing = await manager.findOne(Batch, {
            where: { clientEventId: dto.clientEventId },
          });
          if (existing === null) throw batchIdConflictError();
          return {
            batch: await this.composeDetail(manager, existing.id),
            duplicate: true,
          };
        }

        await this.insertFractions(manager, batchId, fractions.fractions);
        await this.ledgerService.appendWithinTransaction(manager, {
          batchId,
          tipe: 'DIKELUARKAN',
          actorId: actor.id,
          weightKg: dto.weightKg,
          photoHash: dto.photoHash ?? null,
          occurredAt,
        });
        await this.ledgerService.appendWithinTransaction(manager, {
          batchId,
          tipe: 'DITIMBANG',
          actorId: actor.id,
          weightKg: dto.weightKg,
          occurredAt,
        });
        await manager.query(
          `UPDATE batch SET status = $2, gate_status = $3, gate_detail = $4::jsonb WHERE id = $1`,
          [
            batchId,
            targetStatus,
            gate.status,
            JSON.stringify(composeGateDetail(gate, ageHours, serverNow)),
          ],
        );

        return {
          batch: await this.composeDetail(manager, batchId),
          duplicate: false,
        };
      },
    );

    void this.dispatchService.autoAssignOnCreate(actor, sppg.id);
    return result;
  }

  async list(
    query: BatchListQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedItems<BatchDto>> {
    const scopeSppgId = this.resolveListScope(query, actor);
    const limit = query.limit ?? DEFAULT_LIST_LIMIT;
    const baseQuery = () =>
      this.batchRepository
        .createQueryBuilder('b')
        .where(
          scopeSppgId === undefined
            ? 'b.sppgId IS NOT NULL'
            : 'b.sppgId = :scopeSppgId',
          scopeSppgId === undefined ? {} : { scopeSppgId },
        )
        .andWhere(query.status === undefined ? '1=1' : 'b.status = :status', {
          status: query.status,
        })
        .andWhere(
          query.tier === undefined ? '1=1' : 'b.tingkatPutusan = :tier',
          { tier: query.tier },
        )
        .andWhere(query.aliran === undefined ? '1=1' : 'b.aliran = :aliran', {
          aliran: query.aliran,
        });

    const rows = await baseQuery()
      .andWhere(query.cursor === undefined ? '1=1' : 'b.id < :cursor', {
        cursor: query.cursor,
      })
      .orderBy('b.id', 'DESC')
      .take(limit)
      .getMany();
    const total = await baseQuery().getCount();

    const fractions = await this.fractionsByBatchIds(rows.map((row) => row.id));
    const nextCursor =
      rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null;
    return {
      items: rows.map((row) => toBatchDto(row, fractions.get(row.id) ?? [])),
      nextCursor,
      total,
    };
  }

  async getDetail(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<BatchDetailDto> {
    const batch = await this.batchRepository.findOne({ where: { id } });
    if (batch === null) throw batchNotFoundError();
    if (!canReadBatch(actor, batch)) {
      throw forbiddenActionError();
    }
    return this.composeDetail(this.batchRepository.manager, id);
  }

  async reGate(
    id: string,
    dto: { moistureProxy?: string; visibleOil?: boolean },
    actor: AuthenticatedUser,
  ): Promise<BatchDetailDto> {
    const batch = await this.batchRepository.findOne({ where: { id } });
    if (batch === null) throw batchNotFoundError();
    if (actor.role === 'sppg_staff' && actor.sppgId !== batch.sppgId) {
      throw forbiddenActionError();
    }
    if (batch.status !== 'GAGAL_GATE') throw gateNotRetryableError();

    const serverNow = new Date();
    const moistureProxy = (dto.moistureProxy ??
      batch.kadarAirProksi ??
      null) as 'kering' | 'sedang' | 'basah' | null;
    const visibleOil = dto.visibleOil ?? batch.adaMinyakTerlihat;
    const ageHours = Math.max(
      0,
      (serverNow.getTime() - batch.dikeluarkanAt.getTime()) / 3600000,
    );

    const fractions = await this.fractionRepository.find({
      where: { batchId: id },
    });
    const composition: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E', number>> =
      {};
    for (const fraction of fractions) {
      composition[fraction.kode] = fraction.persen;
    }

    const gate = evaluateGate({
      aliran: batch.aliran,
      weightKg: batch.beratKg,
      fractions: composition,
      moistureProxy,
      visibleOil,
      ageHours,
      queueKgToday: 0,
      profile: DEFAULT_SAFE_PROFILE,
      target: null,
    });

    const transitionTarget = BATCH_STATUS_BY_GATE[gate.status];
    if (transitionTarget !== 'GAGAL_GATE') {
      assertTransition(
        'GAGAL_GATE',
        transitionTarget,
        BATCH_STATUS_TRANSITIONS,
        {
          code: 'BATCH_GATE_STATUS_INVALID',
          message: 'Hasil gate tidak menghasilkan status batch yang sah',
        },
      );
    }

    await this.batchRepository.manager.query(
      `UPDATE batch
         SET status = COALESCE($2, status),
             gate_status = $3,
             gate_detail = $4::jsonb,
             kadar_air_proksi = $5,
             ada_minyak_terlihat = $6
       WHERE id = $1`,
      [
        id,
        transitionTarget === 'GAGAL_GATE' ? null : transitionTarget,
        gate.status,
        JSON.stringify(composeGateDetail(gate, ageHours, serverNow)),
        moistureProxy,
        visibleOil,
      ],
    );

    return this.composeDetail(this.batchRepository.manager, id);
  }

  private resolveListScope(
    query: BatchListQueryDto,
    actor: AuthenticatedUser,
  ): string | undefined {
    if (actor.role === 'admin' || actor.role === 'dlh_auditor') {
      return query.sppgId;
    }
    if (actor.role === 'sppg_staff' && actor.sppgId !== null) {
      return actor.sppgId;
    }
    throw forbiddenActionError();
  }

  private async insertBatchRow(
    manager: EntityManager,
    context: {
      batchId: string;
      dto: CreateBatchDto;
      sppgId: string;
      isDemo: boolean;
      occurredAt: Date;
      serverNow: Date;
    },
  ): Promise<string | null> {
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(Batch)
      .values({
        id: context.batchId,
        sppgId: context.sppgId,
        aliran: context.dto.aliran,
        dikeluarkanAt: context.occurredAt,
        beratKg: context.dto.weightKg,
        kadarAirProksi: context.dto.moistureProxy ?? null,
        adaMinyakTerlihat: context.dto.visibleOil ?? false,
        status: 'DICATAT',
        fotoHash: context.dto.photoHash ?? null,
        clientEventId: context.dto.clientEventId,
        clockSkewMs: context.dto.clockSkewMs ?? null,
        isDemo: context.isDemo,
        createdAt: context.serverNow,
      })
      .orIgnore()
      .returning('id')
      .execute();
    const rows = result.raw as readonly { id?: unknown }[];
    const insertedId = rows[0]?.id;
    return typeof insertedId === 'string' ? insertedId : null;
  }

  private async insertFractions(
    manager: EntityManager,
    batchId: string,
    fractions: Readonly<Partial<Record<FractionCode, number>>>,
  ): Promise<void> {
    const rows: BatchFraction[] = [];
    for (const kode of FRACTION_CODES) {
      const persen = fractions[kode];
      if (persen === undefined) continue;
      rows.push(manager.create(BatchFraction, { batchId, kode, persen }));
    }
    if (rows.length === 0) return;
    await manager.insert(BatchFraction, rows);
  }

  private async fractionsByBatchIds(
    batchIds: readonly string[],
  ): Promise<Map<string, BatchFraction[]>> {
    if (batchIds.length === 0) return new Map();
    const rows = await this.fractionRepository
      .createQueryBuilder('f')
      .where('f.batchId IN (:...batchIds)', { batchIds: [...batchIds] })
      .getMany();
    const grouped = new Map<string, BatchFraction[]>();
    for (const row of rows) {
      const list = grouped.get(row.batchId);
      if (list === undefined) {
        grouped.set(row.batchId, [row]);
      } else {
        list.push(row);
      }
    }
    return grouped;
  }

  private async composeDetail(
    manager: EntityManager,
    id: string,
  ): Promise<BatchDetailDto> {
    const batch = await manager.findOne(Batch, { where: { id } });
    if (batch === null) throw batchNotFoundError();
    const fractions = await manager.find(BatchFraction, {
      where: { batchId: id },
    });
    const events = await this.ledgerService.listByBatchWithin(manager, id);
    return {
      ...toBatchDto(batch, fractions),
      ledger: events.map(toLedgerEventDto),
    };
  }
}
