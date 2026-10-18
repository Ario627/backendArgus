import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../common/types.js';
import {
  jakartaDateOf,
  wibDayRangeUtc,
} from '../common/utils/daily-range.util.js';
import type { AppConfiguration } from '../config/configuration.js';
import { buildCsv } from './csv.util.js';
import {
  exportRangeInvalidError,
  exportRateLimitedError,
} from './export.errors.js';
import { renderBatchesPdf } from './pdf/pdf-batches.renderer.js';
import type { PdfBatchRow } from './pdf/pdf-batches.types.js';
import type { ExportBatchesQueryDto } from './dto/export-batches-query.dto.js';

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;
const MAX_EXPORT_ROWS = 10000;
const DAY_MS = 86400000;

const BATCHES_SQL = `
SELECT b.id AS batch_id,
       to_char(b.dikeluarkan_at + INTERVAL '7 hours', 'YYYY-MM-DD') AS tanggal_wib,
       s.nama AS sppg_nama,
       b.aliran,
       b.berat_kg,
       b.gate_status,
       b.tingkat_putusan,
       b.status,
       b.alasan_putusan ->> 'chosenFacilityNama' AS fasilitas_tujuan,
       (SELECT count(*)::int FROM ledger_event le WHERE le.batch_id = b.id) AS jumlah_event,
       (SELECT count(*)::int FROM anomali a WHERE a.batch_id = b.id AND a.ditutup_at IS NULL) AS anomali_terbuka,
       b.is_demo
  FROM batch b
  JOIN sppg s ON s.id = b.sppg_id
 WHERE b.dikeluarkan_at >= $1
   AND b.dikeluarkan_at < $2
   AND ($3::uuid IS NULL OR b.sppg_id = $3)
   AND ($4::bool IS TRUE OR b.is_demo = FALSE)
 ORDER BY b.dikeluarkan_at ASC, b.id ASC
 LIMIT $5`;

const HEADER = Object.freeze([
  'batch_id',
  'tanggal_wib',
  'sppg',
  'aliran',
  'berat_kg',
  'gate_status',
  'tingkat_putusan',
  'status',
  'fasilitas_tujuan',
  'jumlah_event',
  'anomali_terbuka',
  'is_demo',
] as const);

interface BatchExportRow {
  readonly batch_id: string;
  readonly tanggal_wib: string;
  readonly sppg_nama: string;
  readonly aliran: string;
  readonly berat_kg: string;
  readonly gate_status: string | null;
  readonly tingkat_putusan: string | null;
  readonly status: string;
  readonly fasilitas_tujuan: string | null;
  readonly jumlah_event: number;
  readonly anomali_terbuka: number;
  readonly is_demo: boolean;
}

export interface BatchesCsvResult {
  readonly csv: string;
  readonly filename: string;
  readonly rowCount: number;
  readonly truncated: boolean;
  readonly quotaRemaining: number;
}

export interface BatchesPdfResult {
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly rowCount: number;
  readonly pageCount: number;
  readonly truncated: boolean;
  readonly quotaRemaining: number;
}

interface FetchedBatches {
  readonly range: { readonly from: string; readonly to: string };
  readonly rows: readonly BatchExportRow[];
  readonly truncated: boolean;
}

interface QuotaClaim {
  readonly range: { readonly from: string; readonly to: string };
  readonly sppgId: string | undefined;
  readonly format: 'csv' | 'pdf';
  readonly rowCount: number;
  readonly truncated: boolean;
  readonly actor: AuthenticatedUser;
  readonly requestId: string | null;
}

const toPdfRow = (row: BatchExportRow): PdfBatchRow =>
  Object.freeze({
    tanggalWib: row.tanggal_wib,
    sppgNama: row.sppg_nama,
    aliran: row.aliran,
    beratKg: row.berat_kg,
    gateStatus: row.gate_status,
    tingkatPutusan: row.tingkat_putusan,
    status: row.status,
    fasilitasTujuan: row.fasilitas_tujuan,
    jumlahEvent: row.jumlah_event,
    anomaliTerbuka: row.anomali_terbuka,
  });

const shiftDate = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

@Injectable()
export class ExportService {
  private readonly demoMode: boolean;
  private readonly exportPerDay: number;
  private readonly pdfMaxRows: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.demoMode = config.demoMode;
    this.exportPerDay = config.throttle.exportPerDay;
    this.pdfMaxRows = config.export.pdfMaxRows;
  }

  private resolveRange(
    from: string | undefined,
    to: string | undefined,
  ): { from: string; to: string } {
    const today = jakartaDateOf(new Date());
    const resolvedTo = to ?? today;
    const resolvedFrom =
      from ?? shiftDate(resolvedTo, -(DEFAULT_RANGE_DAYS - 1));
    if (resolvedFrom > resolvedTo) {
      throw exportRangeInvalidError([{ code: 'rangeOrder', field: 'from' }]);
    }
    const spanDays =
      (Date.parse(`${resolvedTo}T00:00:00.000Z`) -
        Date.parse(`${resolvedFrom}T00:00:00.000Z`)) /
        DAY_MS +
      1;
    if (spanDays > MAX_RANGE_DAYS) {
      throw exportRangeInvalidError([
        { code: 'rangeTooWide', field: `max ${MAX_RANGE_DAYS} hari` },
      ]);
    }
    return { from: resolvedFrom, to: resolvedTo };
  }

  private async fetchBatches(
    query: ExportBatchesQueryDto,
    maxRows: number,
  ): Promise<FetchedBatches> {
    const range = this.resolveRange(query.from, query.to);
    const rows = await this.dataSource.query<BatchExportRow[]>(BATCHES_SQL, [
      wibDayRangeUtc(range.from).start,
      wibDayRangeUtc(range.to).end,
      query.sppgId ?? null,
      this.demoMode,
      maxRows + 1,
    ]);
    const truncated = rows.length > maxRows;
    return Object.freeze({
      range,
      rows: Object.freeze(truncated ? rows.slice(0, maxRows) : rows),
      truncated,
    });
  }

  private async claimQuota(claim: QuotaClaim): Promise<number> {
    const quota = await this.auditService.consumeExportQuota({
      aktor: claim.actor.id,
      aktorPeran: claim.actor.role,
      limitPerDay: this.exportPerDay,
      detail: {
        format: claim.format,
        from: claim.range.from,
        to: claim.range.to,
        sppgId: claim.sppgId ?? null,
        rowCount: claim.rowCount,
        truncated: claim.truncated,
      },
      requestId: claim.requestId,
    });
    if (!quota.allowed) {
      throw exportRateLimitedError(this.exportPerDay);
    }
    return Math.max(0, this.exportPerDay - quota.used - 1);
  }

  async batchesCsv(
    query: ExportBatchesQueryDto,
    actor: AuthenticatedUser,
    requestId: string | null,
  ): Promise<BatchesCsvResult> {
    const fetched = await this.fetchBatches(query, MAX_EXPORT_ROWS);
    const csv = buildCsv(
      HEADER,
      fetched.rows.map((row) => [
        row.batch_id,
        row.tanggal_wib,
        row.sppg_nama,
        row.aliran,
        row.berat_kg,
        row.gate_status ?? '',
        row.tingkat_putusan ?? '',
        row.status,
        row.fasilitas_tujuan ?? '',
        row.jumlah_event,
        row.anomali_terbuka,
        row.is_demo,
      ]),
    );
    const quotaRemaining = await this.claimQuota({
      range: fetched.range,
      sppgId: query.sppgId,
      format: 'csv',
      rowCount: fetched.rows.length,
      truncated: fetched.truncated,
      actor,
      requestId,
    });
    return Object.freeze({
      csv,
      filename: `argus-batches-${fetched.range.from}_${fetched.range.to}.csv`,
      rowCount: fetched.rows.length,
      truncated: fetched.truncated,
      quotaRemaining,
    });
  }

  async batchesPdf(
    query: ExportBatchesQueryDto,
    actor: AuthenticatedUser,
    requestId: string | null,
  ): Promise<BatchesPdfResult> {
    const fetched = await this.fetchBatches(query, this.pdfMaxRows);
    const document = await renderBatchesPdf({
      rows: fetched.rows.map(toPdfRow),
      range: fetched.range,
      generatedAt: new Date(),
      truncated: fetched.truncated,
      demoIncluded: this.demoMode,
    });
    const quotaRemaining = await this.claimQuota({
      range: fetched.range,
      sppgId: query.sppgId,
      format: 'pdf',
      rowCount: document.rowCount,
      truncated: fetched.truncated,
      actor,
      requestId,
    });
    return Object.freeze({
      bytes: document.bytes,
      filename: `argus-batches-${fetched.range.from}_${fetched.range.to}.pdf`,
      rowCount: document.rowCount,
      pageCount: document.pageCount,
      truncated: fetched.truncated,
      quotaRemaining,
    });
  }
}
