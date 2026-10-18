import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  jakartaDateOf,
  wibDayRangeUtc,
} from '../common/utils/daily-range.util.js';
import type { AppConfiguration } from '../config/configuration.js';
import type { NarrativeAnomalyFact, NarrativeFacts } from '../llm/llm.types.js';

interface BatchAggregateRow {
  readonly total: string;
  readonly total_kg: string;
  readonly gate_lolos: string;
  readonly gate_perbaiki: string;
  readonly gate_alihkan: string;
  readonly gate_tolak: string;
  readonly menunggu_angkut: string;
  readonly gagal_gate: string;
  readonly tersangkut: string;
  readonly selesai: string;
  readonly menunggu_putusan: string;
}

interface CountRow {
  readonly total: string;
}

export interface DashboardSummary {
  readonly date: string;
  readonly scopeSppgId: string | null;
  readonly batch: {
    readonly total: number;
    readonly totalKg: number;
    readonly gate: {
      readonly lolos: number;
      readonly perbaiki: number;
      readonly alihkan: number;
      readonly tolak: number;
    };
    readonly status: {
      readonly menungguAngkut: number;
      readonly gagalGate: number;
      readonly tersangkut: number;
      readonly selesai: number;
    };
    readonly menungguPutusan: number;
  };
  readonly operasional: {
    readonly anomaliTerbuka: number;
    readonly tiketBaru: number;
  };
}

interface NarrativeBatchRow {
  readonly total: number;
  readonly total_kg: string;
  readonly gate_lolos: number;
  readonly gate_perbaiki: number;
  readonly gate_alihkan: number;
  readonly gate_tolak: number;
  readonly menunggu_putusan: number;
  readonly prev_total: number;
  readonly prev_kg: string;
}

interface NarrativeAnomalyRow {
  readonly jenis: NarrativeAnomalyFact['jenis'];
  readonly tingkat: NarrativeAnomalyFact['tingkat'];
  readonly jumlah: number;
}

const NARRATIVE_BATCH_SQL = `
SELECT COUNT(*) FILTER (WHERE dikeluarkan_at >= $1)::int AS total,
       COALESCE(SUM(berat_kg) FILTER (WHERE dikeluarkan_at >= $1), 0) AS total_kg,
       COUNT(*) FILTER (
         WHERE dikeluarkan_at >= $1 AND gate_status = 'LOLOS'
       )::int AS gate_lolos,
       COUNT(*) FILTER (
         WHERE dikeluarkan_at >= $1 AND gate_status = 'PERBAIKI'
       )::int AS gate_perbaiki,
       COUNT(*) FILTER (
         WHERE dikeluarkan_at >= $1 AND gate_status = 'ALIHKAN'
       )::int AS gate_alihkan,
       COUNT(*) FILTER (
         WHERE dikeluarkan_at >= $1 AND gate_status = 'TOLAK'
       )::int AS gate_tolak,
       COUNT(*) FILTER (
         WHERE dikeluarkan_at >= $1
           AND status = 'MENUNGGU_ANGKUT'
           AND tingkat_putusan IS NULL
       )::int AS menunggu_putusan,
       COUNT(*) FILTER (WHERE dikeluarkan_at < $1)::int AS prev_total,
       COALESCE(SUM(berat_kg) FILTER (WHERE dikeluarkan_at < $1), 0) AS prev_kg
  FROM batch
 WHERE dikeluarkan_at >= $2
   AND dikeluarkan_at < $3
   AND ($4::uuid IS NULL OR sppg_id = $4)
   AND ($5::bool IS TRUE OR is_demo = FALSE)`;

const NARRATIVE_ANOMALY_SQL = `
SELECT a.jenis, a.tingkat, count(*)::int AS jumlah
  FROM anomali a
  JOIN batch b ON b.id = a.batch_id
 WHERE a.ditutup_at IS NULL
   AND ($1::uuid IS NULL OR b.sppg_id = $1)
   AND ($2::bool IS TRUE OR a.is_demo = FALSE)
 GROUP BY a.jenis, a.tingkat
 ORDER BY jumlah DESC, a.jenis ASC
 LIMIT 5`;

const NARRATIVE_TICKET_SQL = `
SELECT count(*)::int AS total
  FROM tiket_warga
 WHERE status = 'BARU'
   AND ($1::uuid IS NULL OR sppg_id = $1)
   AND ($2::bool IS TRUE OR is_demo = FALSE)`;

const toNumber = (value: string | number | null | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

const roundKg = (value: number): number => Math.round(value * 100) / 100;

@Injectable()
export class DashboardService {
  private readonly demoMode: boolean;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.demoMode = config.demoMode;
  }

  async narrativeFacts(scopeSppgId: string | null): Promise<NarrativeFacts> {
    const today = wibDayRangeUtc(jakartaDateOf(new Date()));
    const yesterdayStart = new Date(today.start.getTime() - 86400000);
    const [batchRow] = await this.dataSource.query<NarrativeBatchRow[]>(
      NARRATIVE_BATCH_SQL,
      [today.start, yesterdayStart, today.end, scopeSppgId, this.demoMode],
    );
    const anomalyRows = await this.dataSource.query<NarrativeAnomalyRow[]>(
      NARRATIVE_ANOMALY_SQL,
      [scopeSppgId, this.demoMode],
    );
    const [ticketRow] = await this.dataSource.query<CountRow[]>(
      NARRATIVE_TICKET_SQL,
      [scopeSppgId, this.demoMode],
    );
    return Object.freeze({
      tanggal: today.date,
      cakupan: scopeSppgId === null ? 'semua' : 'sppg',
      batch: Object.freeze({
        total: toNumber(batchRow?.total),
        totalKg: roundKg(toNumber(batchRow?.total_kg)),
        gate: Object.freeze({
          lolos: toNumber(batchRow?.gate_lolos),
          perbaiki: toNumber(batchRow?.gate_perbaiki),
          alihkan: toNumber(batchRow?.gate_alihkan),
          tolak: toNumber(batchRow?.gate_tolak),
        }),
        menungguPutusan: toNumber(batchRow?.menunggu_putusan),
      }),
      sebelumnya: Object.freeze({
        total: toNumber(batchRow?.prev_total),
        totalKg: roundKg(toNumber(batchRow?.prev_kg)),
      }),
      anomaliTerbuka: Object.freeze(
        anomalyRows.map((row) =>
          Object.freeze({
            jenis: row.jenis,
            tingkat: row.tingkat,
            jumlah: toNumber(row.jumlah),
          }),
        ),
      ),
      tiketBaru: toNumber(ticketRow?.total),
      adaDataDemo: this.demoMode,
    });
  }

  async summary(scopeSppgId: string | null): Promise<DashboardSummary> {
    const range = wibDayRangeUtc(jakartaDateOf(new Date()));
    const [batchRow] = await this.dataSource.query<BatchAggregateRow[]>(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(berat_kg), 0) AS total_kg,
              COUNT(*) FILTER (WHERE gate_status = 'LOLOS') AS gate_lolos,
              COUNT(*) FILTER (WHERE gate_status = 'PERBAIKI') AS gate_perbaiki,
              COUNT(*) FILTER (WHERE gate_status = 'ALIHKAN') AS gate_alihkan,
              COUNT(*) FILTER (WHERE gate_status = 'TOLAK') AS gate_tolak,
              COUNT(*) FILTER (WHERE status = 'MENUNGGU_ANGKUT') AS menunggu_angkut,
              COUNT(*) FILTER (WHERE status = 'GAGAL_GATE') AS gagal_gate,
              COUNT(*) FILTER (WHERE status = 'TERSANGKUT') AS tersangkut,
              COUNT(*) FILTER (WHERE status = 'SELESAI') AS selesai,
              COUNT(*) FILTER (WHERE status = 'MENUNGGU_ANGKUT' AND tingkat_putusan IS NULL) AS menunggu_putusan
         FROM batch
        WHERE dikeluarkan_at >= $1 AND dikeluarkan_at < $2
          AND ($3::uuid IS NULL OR sppg_id = $3)
          AND ($4::bool IS TRUE OR is_demo = FALSE)`,
      [range.start, range.end, scopeSppgId, this.demoMode],
    );

    const [anomaliRow] = await this.dataSource.query<CountRow[]>(
      `SELECT COUNT(*) AS total
         FROM anomali a
         JOIN batch b ON b.id = a.batch_id
        WHERE a.ditutup_at IS NULL
          AND ($1::uuid IS NULL OR b.sppg_id = $1)
          AND ($2::bool IS TRUE OR a.is_demo = FALSE)`,
      [scopeSppgId, this.demoMode],
    );

    const [tiketRow] = await this.dataSource.query<CountRow[]>(
      `SELECT COUNT(*) AS total
         FROM tiket_warga
        WHERE status = 'BARU'
          AND ($1::uuid IS NULL OR sppg_id = $1)
          AND ($2::bool IS TRUE OR is_demo = FALSE)`,
      [scopeSppgId, this.demoMode],
    );

    return Object.freeze({
      date: range.date,
      scopeSppgId,
      batch: Object.freeze({
        total: toNumber(batchRow?.total),
        totalKg: toNumber(batchRow?.total_kg),
        gate: Object.freeze({
          lolos: toNumber(batchRow?.gate_lolos),
          perbaiki: toNumber(batchRow?.gate_perbaiki),
          alihkan: toNumber(batchRow?.gate_alihkan),
          tolak: toNumber(batchRow?.gate_tolak),
        }),
        status: Object.freeze({
          menungguAngkut: toNumber(batchRow?.menunggu_angkut),
          gagalGate: toNumber(batchRow?.gagal_gate),
          tersangkut: toNumber(batchRow?.tersangkut),
          selesai: toNumber(batchRow?.selesai),
        }),
        menungguPutusan: toNumber(batchRow?.menunggu_putusan),
      }),
      operasional: Object.freeze({
        anomaliTerbuka: toNumber(anomaliRow?.total),
        tiketBaru: toNumber(tiketRow?.total),
      }),
    });
  }
}
