import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { chosenFacilityIdOf } from '../batch/batch-access.util.js';
import { sppgNotFoundError } from '../sppg/sppg.errors.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type { AuthenticatedUser } from '../common/types.js';
import { jakartaDateOf, wibDayRangeUtc, type UtcDayRange } from '../common/utils/daily-range.util.js';
import { ParameterService } from '../parameter/parameter.service.js';
import { BatchFraction } from '../database/entities/batch-fraction.entity.js';
import { Batch } from '../database/entities/batch.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { CandidateBuilder } from './candidate.builder.js';
import {
  toBatchDispositionDetail,
  toQueueItem,
  type BatchDispositionDetail,
  type DispositionQueueItem,
} from './disposition.mapper.js';
import type { DispositionListQueryDto } from './dto/disposition-list-query.dto.js';
import type { RunDispositionDto } from './dto/run-disposition.dto.js';
import { assembleScoreParameters } from './parameter.assembler.js';
import type { DispositionTier } from '../common/constant/domain.constant.js';
import { hitungSkorDisposisi, type ScoreBatch } from './score.util.js';

const QUEUE_BATCH_STATUS = 'MENUNGGU_ANGKUT';

export interface RunDecision {
  readonly batchId: string;
  readonly chosenTier: DispositionTier;
  readonly chosenFacilityId: string | null;
  readonly chosenFacilityNama: string | null;
  readonly reason: string;
}

export interface RunReport {
  readonly sppgId: string;
  readonly date: string;
  readonly processed: number;
  readonly decisions: readonly RunDecision[];
  readonly missingParameters: readonly string[];
}

@Injectable()
export class DispositionService {
  constructor(
    @InjectRepository(Batch) private readonly batchRepository: Repository<Batch>,
    @InjectRepository(BatchFraction)
    private readonly fractionRepository: Repository<BatchFraction>,
    @InjectRepository(Sppg) private readonly sppgRepository: Repository<Sppg>,
    private readonly candidateBuilder: CandidateBuilder,
    private readonly parameterService: ParameterService,
  ) {}

  async run(dto: RunDispositionDto, actor: AuthenticatedUser): Promise<RunReport> {
    const sppg = await this.sppgRepository.findOne({ where: { id: dto.sppgId } });
    if (sppg === null) throw sppgNotFoundError();

    const range = this.resolveRange(dto.date);
    const batches = await this.loadQueueBatches(sppg.id, range);
    if (batches.length === 0) {
      return Object.freeze({
        sppgId: sppg.id,
        date: range.date,
        processed: 0,
        decisions: Object.freeze([]),
        missingParameters: Object.freeze([]),
      });
    }

    const fractionsByBatch = await this.loadFractions(batches.map((batch) => batch.id));
    const baseCandidates = await this.candidateBuilder.build(sppg);
    const queue = await this.candidateBuilder.queueByFacility(
      sppg.id,
      range,
      batches.map((batch) => batch.id),
    );
    const readings = await this.parameterService.getMany([
      'biaya_per_km',
      'faktor_muat',
      'biaya_tolak',
      'penalti_umur_per_jam',
      'kecepatan_kota_km_jam',
    ]);
    const { params, missing } = assembleScoreParameters(readings);

    const now = new Date();
    const decisions: RunDecision[] = [];

    for (const batch of batches) {
      const scoreBatch = this.toScoreBatch(batch, fractionsByBatch.get(batch.id) ?? [], now);
      const candidates = baseCandidates.map((candidate) =>
        Object.freeze({ ...candidate, queueKgToday: queue.get(candidate.facilityId) ?? 0 }),
      );
      const decision = hitungSkorDisposisi(scoreBatch, candidates, params);
      const alasan = {
        ...decision,
        parameters: params,
        missingParameters: missing,
        decidedAt: new Date().toISOString(),
        decidedBy: actor.id,
      };
      await this.batchRepository.manager.query(
        'UPDATE batch SET tingkat_putusan = $2, alasan_putusan = $3::jsonb WHERE id = $1',
        [batch.id, decision.chosenTier, JSON.stringify(alasan)],
      );
      if (decision.chosenFacilityId !== null) {
        queue.set(
          decision.chosenFacilityId,
          (queue.get(decision.chosenFacilityId) ?? 0) + batch.beratKg,
        );
      }
      decisions.push(
        Object.freeze({
          batchId: batch.id,
          chosenTier: decision.chosenTier,
          chosenFacilityId: decision.chosenFacilityId,
          chosenFacilityNama: decision.chosenFacilityNama,
          reason: decision.reason,
        }),
      );
    }

    return Object.freeze({
      sppgId: sppg.id,
      date: range.date,
      processed: batches.length,
      decisions: Object.freeze(decisions),
      missingParameters: missing,
    });
  }

  async list(
    query: DispositionListQueryDto,
    actor: AuthenticatedUser,
  ): Promise<readonly DispositionQueueItem[]> {
    const range = this.resolveRange(query.date);
    const scopedSppgId = this.resolveListScope(query, actor);
    const now = new Date();

    const qb = this.batchRepository
      .createQueryBuilder('b')
      .where('b.dikeluarkanAt >= :start AND b.dikeluarkanAt < :end', {
        start: range.start,
        end: range.end,
      })
      .orderBy('b.dikeluarkanAt', 'ASC');

    if (scopedSppgId !== undefined) {
      qb.andWhere('b.sppgId = :sppgId', { sppgId: scopedSppgId });
    }
    if (actor.role === 'facility') {
      qb.andWhere("b.alasan_putusan->>'chosenFacilityId' = :facilityId", {
        facilityId: actor.facilityId,
      });
    }

    const rows = await qb.getMany();
    return Object.freeze(rows.map((batch) => Object.freeze(toQueueItem(batch, now))));
  }

  async getBatchDisposition(
    batchId: string,
    actor: AuthenticatedUser,
  ): Promise<BatchDispositionDetail> {
    const batch = await this.batchRepository.findOne({ where: { id: batchId } });
    if (batch === null) throw sppgNotFoundError();
    if (!canReadDisposition(actor, batch)) throw forbiddenActionError();
    return Object.freeze(toBatchDispositionDetail(batch));
  }

  private resolveRange(date?: string): UtcDayRange {
    return wibDayRangeUtc(date ?? jakartaDateOf(new Date()));
  }

  private resolveListScope(
    query: DispositionListQueryDto,
    actor: AuthenticatedUser,
  ): string | undefined {
    if (actor.role === 'admin' || actor.role === 'dlh_auditor') return query.sppgId;
    if (actor.role === 'sppg_staff') {
      if (actor.sppgId === null) throw forbiddenActionError();
      if (query.sppgId !== undefined && query.sppgId !== actor.sppgId) throw forbiddenActionError();
      return actor.sppgId;
    }
    if (actor.role === 'facility') {
      if (actor.facilityId === null) throw forbiddenActionError();
      return query.sppgId;
    }
    throw forbiddenActionError();
  }

  private async loadQueueBatches(sppgId: string, range: UtcDayRange): Promise<readonly Batch[]> {
    return this.batchRepository
      .createQueryBuilder('b')
      .where('b.sppgId = :sppgId', { sppgId })
      .andWhere('b.status = :status', { status: QUEUE_BATCH_STATUS })
      .andWhere('b.dikeluarkanAt >= :start AND b.dikeluarkanAt < :end', {
        start: range.start,
        end: range.end,
      })
      .orderBy('b.dikeluarkanAt', 'ASC')
      .getMany();
  }

  private async loadFractions(
    batchIds: readonly string[],
  ): Promise<Map<string, readonly BatchFraction[]>> {
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

  private toScoreBatch(
    batch: Batch,
    fractions: readonly BatchFraction[],
    now: Date,
  ): ScoreBatch {
    const composition: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E', number>> = {};
    for (const fraction of fractions) {
      composition[fraction.kode] = fraction.persen;
    }
    return {
      aliran: batch.aliran,
      weightKg: batch.beratKg,
      ageHours: Math.max(0, (now.getTime() - batch.dikeluarkanAt.getTime()) / 3600000),
      fractions: composition,
      moistureProxy: batch.kadarAirProksi,
      visibleOil: batch.adaMinyakTerlihat,
    };
  }
}

const canReadDisposition = (actor: AuthenticatedUser, batch: Batch): boolean => {
  if (actor.role === 'admin' || actor.role === 'dlh_auditor') return true;
  if (actor.role === 'sppg_staff') return actor.sppgId === batch.sppgId;
  if (actor.role === 'facility') {
    return chosenFacilityIdOf(batch.alasanPutusan) === actor.facilityId && actor.facilityId !== null;
  }
  return false;
};