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
import { ParameterService } from '../parameter/parameter.service.js';
import type { DashboardImpactDto } from './impact.dto.js';
import {
  compareImpact,
  type ImpactBatchRow,
  type ImpactCandidateRow,
  type ImpactFacility,
} from './impact.util.js';

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
    private readonly parameterService: ParameterService,
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

  async impact(scopeSppgId: string | null): Promise<DashboardImpactDto> {
    const range = wibDayRangeUtc(jakartaDateOf(new Date()));

    const rows = await this.dataSource.query<
      {
        readonly id: string;
        readonly sppg_id: string;
        readonly sppg_lat: number;
        readonly sppg_lng: number;
        readonly status: string;
        readonly tingkat_putusan: string | null;
        readonly alasan_putusan: Record<string, unknown> | null;
      }[]
    >(
      `SELECT b.id,
              b.sppg_id,
              s.lat AS sppg_lat,
              s.lng AS sppg_lng,
              b.status,
              b.tingkat_putusan,
              b.alasan_putusan
         FROM batch b
         JOIN sppg s ON s.id = b.sppg_id
        WHERE b.dikeluarkan_at >= $1 AND b.dikeluarkan_at < $2
          AND ($3::uuid IS NULL OR b.sppg_id = $3)
          AND ($4::bool IS TRUE OR b.is_demo = FALSE)`,
      [range.start, range.end, scopeSppgId, this.demoMode],
    );

    const facilities = await this.dataSource.query<ImpactFacility[]>(
      `SELECT id, nama, lat, lng FROM fasilitas WHERE aktif = TRUE`,
    );

    const readCandidates = (
      alasan: Record<string, unknown> | null,
    ): readonly ImpactCandidateRow[] => {
      if (alasan === null) return [];
      const raw = alasan['candidates'];
      if (!Array.isArray(raw)) return [];
      const parsed: ImpactCandidateRow[] = [];
      for (const entry of raw) {
        if (entry === null || typeof entry !== 'object') continue;
        const record = entry as Record<string, unknown>;
        const facilityId = record['facilityId'];
        if (typeof facilityId !== 'string') continue;
        parsed.push({ facilityId, eligible: record['eligible'] === true });
      }
      return parsed;
    };

    const batches: ImpactBatchRow[] = rows.map((row) => {
      const alasan =
        row.alasan_putusan !== null && typeof row.alasan_putusan === 'object'
          ? row.alasan_putusan
          : null;
      const chosen =
        alasan === null || typeof alasan['chosenFacilityId'] !== 'string'
          ? null
          : alasan['chosenFacilityId'];
      return {
        id: row.id,
        sppgId: row.sppg_id,
        sppgLat: row.sppg_lat,
        sppgLng: row.sppg_lng,
        status: row.status,
        tier: row.tingkat_putusan,
        chosenFacilityId: chosen,
        candidates: readCandidates(alasan),
      };
    });

    const biayaRow = await this.parameterService.getValue('biaya_per_km');
    const biayaPerKm =
      typeof biayaRow?.nilai === 'number' && biayaRow.nilai > 0
        ? biayaRow.nilai
        : null;

    const comparison = compareImpact(batches, facilities, biayaPerKm);

    return Object.freeze({
      date: range.date,
      scopeSppgId,
      biayaPerKm,
      batch: comparison.batch,
      nearest: comparison.nearest,
      argus: comparison.argus,
      dibandingkan: comparison.dibandingkan,
      catatan:
        'Rute terdekat dihitung dari jarak lurus SPPG ke fasilitas terdekat tanpa memeriksa profil penerimaan; keputusan ARGUS memakai fasilitas yang lolos profil dan menahan yang bisa ditangani di sumber. Angka ini bahan pengujian, bukan klaim penghematan.',
    });
  }
}
