import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { canReadBatch } from '../batch/batch-access.util.js';
import { batchNotFoundError } from '../batch/batch.errors.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type { AuthenticatedUser } from '../common/types.js';
import { verifyChain } from '../common/utils/hash.util.js';
import type { AppConfiguration } from '../config/configuration.js';
import { BatchFraction } from '../database/entities/batch-fraction.entity.js';
import { Batch } from '../database/entities/batch.entity.js';
import { LedgerEvent } from '../database/entities/ledger-event.entity.js';
import { strukTokenInvalidError } from './struk.errors.js';
import {
  toWibDate,
  toWibTime,
  type PublicStrukDto,
  type StrukFractionDto,
  type StrukLinkDto,
} from './struk.mapper.js';
import { signStrukToken, verifyStrukToken } from './struk-token.util.js';

const BATCH_VIEW_SQL = `
SELECT b.id AS batch_id,
       s.nama AS sppg_nama,
       s.alamat AS sppg_alamat,
       b.aliran,
       b.dikeluarkan_at,
       b.berat_kg,
       b.gate_status,
       b.tingkat_putusan,
       b.status,
       b.is_demo
  FROM batch b
  JOIN sppg s ON s.id = b.sppg_id
 WHERE b.id = $1`;

const HOUR_MS = 3600000;

interface BatchView {
  readonly batchId: string;
  readonly sppgNama: string;
  readonly sppgAlamat: string | null;
  readonly aliran: Batch['aliran'];
  readonly dikeluarkanAt: Date;
  readonly beratKg: number;
  readonly gateStatus: Batch['gateStatus'];
  readonly tingkatPutusan: string | null;
  readonly status: Batch['status'];
  readonly isDemo: boolean;
}

interface BatchViewRow {
  readonly batch_id: string;
  readonly sppg_nama: string;
  readonly sppg_alamat: string | null;
  readonly aliran: BatchView['aliran'];
  readonly dikeluarkan_at: Date;
  readonly berat_kg: string;
  readonly gate_status: BatchView['gateStatus'];
  readonly tingkat_putusan: string | null;
  readonly status: BatchView['status'];
  readonly is_demo: boolean;
}

const toBatchView = (row: BatchViewRow): BatchView => ({
  batchId: row.batch_id,
  sppgNama: row.sppg_nama,
  sppgAlamat: row.sppg_alamat,
  aliran: row.aliran,
  dikeluarkanAt: row.dikeluarkan_at,
  beratKg: Number(row.berat_kg),
  gateStatus: row.gate_status,
  tingkatPutusan: row.tingkat_putusan,
  status: row.status,
  isDemo: row.is_demo,
});

const toFractions = (
  rows: readonly BatchFraction[],
): readonly StrukFractionDto[] =>
  Object.freeze(
    rows
      .map((row) => Object.freeze({ kode: row.kode, persen: row.persen }))
      .sort((left, right) => left.kode.localeCompare(right.kode)),
  );

@Injectable()
export class StrukService {
  private readonly secret: string;
  private readonly ttlHours: number;
  private readonly publicBaseUrl: string;

  constructor(
    @InjectRepository(Batch)
    private readonly batchRepository: Repository<Batch>,
    @InjectRepository(BatchFraction)
    private readonly fractionRepository: Repository<BatchFraction>,
    @InjectRepository(LedgerEvent)
    private readonly ledgerEventRepository: Repository<LedgerEvent>,
    @InjectDataSource() private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.secret = config.struk.tokenSecret;
    this.ttlHours = config.struk.ttlHours;
    this.publicBaseUrl = config.publicAppUrl;
  }

  private resolveExpiry(now: Date): Date {
    return new Date(now.getTime() + this.ttlHours * HOUR_MS);
  }

  private async resolveBatchView(batchId: string): Promise<BatchView | null> {
    const rows = await this.dataSource.query<readonly BatchViewRow[]>(
      BATCH_VIEW_SQL,
      [batchId],
    );
    const row = rows[0];
    return row === undefined ? null : toBatchView(row);
  }

  async mintLink(
    batchId: string,
    actor: AuthenticatedUser,
  ): Promise<StrukLinkDto> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
    });
    if (batch === null) throw batchNotFoundError();
    if (!canReadBatch(actor, batch)) throw forbiddenActionError();
    const expiresAt = this.resolveExpiry(new Date());
    const token = signStrukToken({
      secret: this.secret,
      batchId: batch.id,
      expiresAt,
    });
    return Object.freeze({
      url: `${this.publicBaseUrl}/struk/${token}`,
      berlakuSampai: expiresAt.toISOString(),
    });
  }

  async buildPublicStruk(token: string): Promise<PublicStrukDto> {
    const verification = verifyStrukToken({
      secret: this.secret,
      token,
      now: new Date(),
    });
    if (!verification.ok) throw strukTokenInvalidError(verification.reason);
    const view = await this.resolveBatchView(verification.batchId);
    if (view === null) throw strukTokenInvalidError('MALFORMED');
    const [fractions, events] = await Promise.all([
      this.fractionRepository.find({ where: { batchId: view.batchId } }),
      this.ledgerEventRepository.find({
        where: { batchId: view.batchId },
        order: { id: 'ASC' },
      }),
    ]);
    const chain = verifyChain(
      events.map((event) => ({
        id: event.id,
        prevHash: event.prevHash,
        hash: event.hash,
        payload: event.payload,
      })),
    );
    return Object.freeze({
      batchId: view.batchId,
      sppgNama: view.sppgNama,
      sppgAlamat: view.sppgAlamat,
      aliran: view.aliran,
      tanggalWib: toWibDate(view.dikeluarkanAt),
      jamWib: toWibTime(view.dikeluarkanAt),
      beratKg: view.beratKg,
      fraksi: toFractions(fractions),
      gateStatus: view.gateStatus,
      tingkatPutusan: view.tingkatPutusan,
      status: view.status,
      rantaiUtuh: chain.ok,
      jumlahEvent: events.length,
      jejak: Object.freeze(
        events.map((event) =>
          Object.freeze({
            tipe: event.tipe,
            waktu: event.waktuKejadian.toISOString(),
          }),
        ),
      ),
      isDemo: view.isDemo,
      berlakuSampai: verification.expiresAt.toISOString(),
    });
  }
}