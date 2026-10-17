import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { batchNotFoundError } from '../batch/batch.errors.js';
import { canReadBatch } from '../batch/batch-access.util.js';
import type { AuthenticatedUser } from '../common/types.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import { verifyChain } from '../common/utils/hash.util.js';
import { AcceptanceProfile } from '../database/entities/acceptance-profile.entity.js';
import { AnomalyWriterService } from '../anomaly/anomaly-writer.service.js';
import { Batch } from '../database/entities/batch.entity.js';
import { LedgerEvent } from '../database/entities/ledger-event.entity.js';
import { User } from '../database/entities/user.entity.js';
import { ParameterService } from '../parameter/parameter.service.js';
import type { LedgerEventDto } from './ledger.mapper.js';
import { toLedgerEventDto } from './ledger.mapper.js';
import { LedgerService } from './ledger.service.js';
import { computeMassBalance } from './mass-balance.util.js';
import { computeSpoilage } from './spoilage.util.js';
import { TransferService } from './transfer.service.js';
import type {
  AnomalyReport,
  MassBalanceReport,
  SpoilageReport,
  VerificationReport,
} from './ledger-verify.types.js';
import type { TransferEvaluation } from './transfer.util.js';

const RECENT_EVENTS_LIMIT = 100;

export interface LedgerListReport {
  readonly batchId: string;
  readonly transferStatus: TransferEvaluation['status'];
  readonly transfer: TransferEvaluation;
  readonly events: readonly LedgerEventDto[];
}

@Injectable()
export class LedgerVerifyService {
  constructor(
    @InjectRepository(Batch)
    private readonly batchRepository: Repository<Batch>,
    @InjectRepository(LedgerEvent)
    private readonly ledgerEventRepository: Repository<LedgerEvent>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(AcceptanceProfile)
    private readonly profileRepository: Repository<AcceptanceProfile>,
    private readonly ledgerService: LedgerService,
    private readonly transferService: TransferService,
    private readonly parameterService: ParameterService,
    private readonly anomalyWriter: AnomalyWriterService,
  ) {}

  async listEvents(
    batchId: string,
    actor: AuthenticatedUser,
  ): Promise<LedgerListReport> {
    await this.requireReadableBatch(batchId, actor);
    const rows = await this.ledgerService.listByBatch(batchId);
    const transfer = await this.transferService.evaluate(rows);
    return {
      batchId,
      transferStatus: transfer.status,
      transfer,
      events: rows.map(toLedgerEventDto),
    };
  }

  async recentEvents(): Promise<readonly LedgerEventDto[]> {
    const rows = await this.ledgerEventRepository.find({
      order: { id: 'DESC' },
      take: RECENT_EVENTS_LIMIT,
    });
    return rows.map(toLedgerEventDto);
  }

  async verify(
    batchId: string,
    actor: AuthenticatedUser,
  ): Promise<VerificationReport> {
    const batch = await this.requireReadableBatch(batchId, actor);
    return this.verifyLoadedBatch(batch);
  }

  async verifyBatch(batchId: string): Promise<VerificationReport> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
    });
    if (batch === null) throw batchNotFoundError();
    return this.verifyLoadedBatch(batch);
  }

  private async verifyLoadedBatch(batch: Batch): Promise<VerificationReport> {
    const batchId = batch.id;
    const rows = await this.ledgerService.listByBatch(batchId);
    const chain = verifyChain(
      rows.map((row) => ({
        id: row.id,
        prevHash: row.prevHash,
        hash: row.hash,
        payload: row.payload,
      })),
    );
    const transfer = await this.transferService.evaluate(rows);
    const notes: string[] = [];
    const anomalies: AnomalyReport[] = [];

    if (!chain.ok && chain.breach !== null) {
      anomalies.push({
        jenis: 'RANTAI_TIMPA',
        tingkat: 'KRITIS',
        detail: {
          index: chain.breach.index,
          eventId: String(chain.breach.id),
          reason: chain.breach.reason,
        },
      });
    }
    if (transfer.withinTolerance === false) {
      anomalies.push({
        jenis: 'NERACA_MASSA',
        tingkat: 'PERHATIAN',
        detail: {
          kind: 'SAKSI_BEDA',
          senderKg: transfer.senderKg,
          receiverKg: transfer.receiverKg,
          diffKg: transfer.diffKg,
        },
      });
    }

    const massBalance = await this.buildMassBalanceReport(
      rows,
      transfer.handedOverKg,
      notes,
    );
    if (
      massBalance !== null &&
      !massBalance.ok &&
      massBalance.severity !== null
    ) {
      anomalies.push({
        jenis: 'NERACA_MASSA',
        tingkat: massBalance.severity,
        detail: {
          deltaPercent: massBalance.deltaPercent,
          expectedMinKg: massBalance.expectedMinKg,
          expectedMaxKg: massBalance.expectedMaxKg,
          receivedKg: massBalance.receivedKg,
        },
      });
    }

    const spoilage = await this.buildSpoilageReport(rows);
    if (spoilage.late === true) {
      anomalies.push({
        jenis: 'DURASI_UMUR',
        tingkat: 'PERHATIAN',
        detail: {
          elapsedHours: spoilage.elapsedHours,
          maxAgeHours: spoilage.maxAgeHours,
        },
      });
    }

    await this.anomalyWriter.persist(batch.id, batch.isDemo, anomalies);

    return Object.freeze({
      batchId,
      chainOk: chain.ok,
      eventsChecked: chain.checked,
      chainIssue:
        chain.breach === null
          ? null
          : {
              index: chain.breach.index,
              eventId: String(chain.breach.id),
              reason: chain.breach.reason,
            },
      transferStatus: transfer.status,
      transfer,
      massBalance,
      spoilage,
      anomalies: Object.freeze(anomalies),
      notes: Object.freeze(notes),
    });
  }

  private async buildMassBalanceReport(
    rows: readonly LedgerEvent[],
    handedOverKg: number | null,
    notes: string[],
  ): Promise<MassBalanceReport | null> {
    const receivedRow = this.latestByType(rows, 'DITERIMA');
    if (receivedRow?.beratKg === null || receivedRow?.beratKg === undefined) {
      notes.push('MENUNGGU_TIMBANGAN_TERIMA');
      return null;
    }
    if (handedOverKg === null) {
      notes.push('MENUNGGU_SAKSI_SERAH_TERIMA');
      return null;
    }
    const readings = await this.parameterService.getMany([
      'susut_wajar_proksi',
      'toleransi_neraca',
    ]);
    const susut = readings.get('susut_wajar_proksi');
    const toleransi = readings.get('toleransi_neraca');
    if (
      susut?.nilai === null ||
      susut?.nilai === undefined ||
      toleransi?.nilai === null ||
      toleransi?.nilai === undefined
    ) {
      notes.push('PARAMETER_BELUM_TERKALIBRASI');
      return null;
    }
    const result = computeMassBalance({
      handedOverKg,
      receivedKg: receivedRow.beratKg,
      susutWajar: susut.nilai,
      toleransi: toleransi.nilai,
    });
    return Object.freeze({
      ...result,
      handedOverKg,
      receivedKg: receivedRow.beratKg,
      parameter: Object.freeze({
        susutWajar: susut.nilai,
        toleransi: toleransi.nilai,
        susutWajarSumber: susut.sumber,
        toleransiSumber: toleransi.sumber,
      }),
    });
  }

  private async buildSpoilageReport(
    rows: readonly LedgerEvent[],
  ): Promise<SpoilageReport> {
    const releasedAt =
      rows.find((row) => row.tipe === 'DIKELUARKAN')?.waktuKejadian ?? null;
    const receivedAt =
      this.latestByType(rows, 'DITERIMA')?.waktuKejadian ?? null;
    const maxAgeHours = await this.resolveMaxAgeHours(rows);
    return computeSpoilage({
      releasedAt,
      receivedAt,
      now: new Date(),
      maxAgeHours,
    });
  }

  private async resolveMaxAgeHours(
    rows: readonly LedgerEvent[],
  ): Promise<number | null> {
    const actorIds = [
      ...new Set(
        rows
          .filter(
            (row) => row.tipe === 'DITERIMA' || row.tipe === 'SERAH_TERIMA',
          )
          .map((row) => row.aktor)
          .filter((id): id is string => id !== null),
      ),
    ];
    if (actorIds.length === 0) return null;
    const users = await this.userRepository.find({
      where: { id: In(actorIds) },
    });
    const facilityIds = [
      ...new Set(
        users
          .map((user) => user.facilityId)
          .filter((id): id is string => id !== null),
      ),
    ];
    for (const facilityId of facilityIds) {
      const profile = await this.profileRepository.findOne({
        where: { fasilitasId: facilityId, berlakuSampai: IsNull() },
      });
      const value = profile?.aturan['maxAgeHours'];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0)
        return value;
    }
    return null;
  }

  private latestByType(
    rows: readonly LedgerEvent[],
    tipe: LedgerEvent['tipe'],
  ): LedgerEvent | null {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      if (row.tipe === tipe) return row;
    }
    return null;
  }

  private async requireReadableBatch(
    batchId: string,
    actor: AuthenticatedUser,
  ): Promise<Batch> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
    });
    if (batch === null) throw batchNotFoundError();
    if (!canReadBatch(actor, batch)) {
      throw forbiddenActionError();
    }
    return batch;
  }
}
