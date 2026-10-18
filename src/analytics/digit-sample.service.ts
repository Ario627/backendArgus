import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AnalyticsSample } from './analytics.contract.js';
import { toAnalyticsSample } from './digit-sample.mapper.js';
import type { SppgCandidate } from './digit-sample.util.js';

const CANDIDATES_SQL = `
SELECT b.sppg_id AS "sppgId",
       s.is_demo AS "isDemo",
       count(*)::int AS "manualCount"
  FROM ledger_event le
  JOIN batch b ON b.id = le.batch_id
  JOIN sppg s ON s.id = b.sppg_id
 WHERE le.tipe = 'DITIMBANG'
   AND le.device_id IS NULL
   AND le.berat_kg IS NOT NULL
   AND le.waktu_kejadian >= $1
   AND ($2::uuid IS NULL OR b.sppg_id = $2)
   AND ($5::bool IS TRUE OR b.is_demo = FALSE)
 GROUP BY b.sppg_id, s.is_demo
 ORDER BY count(*) DESC, b.sppg_id ASC
 LIMIT $3 OFFSET $4`;

const COUNT_CANDIDATES_SQL = `
SELECT count(DISTINCT b.sppg_id)::int AS total
  FROM ledger_event le
  JOIN batch b ON b.id = le.batch_id
 WHERE le.tipe = 'DITIMBANG'
   AND le.device_id IS NULL
   AND le.berat_kg IS NOT NULL
   AND le.waktu_kejadian >= $1
   AND ($2::uuid IS NULL OR b.sppg_id = $2)
   AND ($3::bool IS TRUE OR b.is_demo = FALSE)`;

const SAMPLES_SQL = `
SELECT le.batch_id AS "batchId",
       le.berat_kg AS "beratKg",
       le.waktu_kejadian AS "waktuKejadian",
       le.device_id AS "deviceId"
  FROM ledger_event le
  JOIN batch b ON b.id = le.batch_id
 WHERE b.sppg_id = $1
   AND le.tipe = 'DITIMBANG'
   AND le.berat_kg IS NOT NULL
   AND le.waktu_kejadian >= $2
 ORDER BY le.waktu_kejadian DESC, le.id DESC
 LIMIT $3`;

interface CandidateRow {
  readonly sppgId: string;
  readonly isDemo: boolean;
  readonly manualCount: number;
}

interface CountRow {
  readonly total: number;
}

interface SampleRow {
  readonly batchId: string;
  readonly beratKg: string;
  readonly waktuKejadian: Date;
  readonly deviceId: string | null;
}

export interface CandidatePage {
  readonly candidates: readonly SppgCandidate[];
  readonly total: number;
}

@Injectable()
export class DigitSampleService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async candidates(
    since: Date,
    sppgId: string | null,
    limit: number,
    offset: number,
    demoMode: boolean,
  ): Promise<CandidatePage> {
    const rows = await this.dataSource.query<CandidateRow[]>(CANDIDATES_SQL, [
      since,
      sppgId,
      limit,
      offset,
      demoMode,
    ]);
    const [countRow] = await this.dataSource.query<CountRow[]>(
      COUNT_CANDIDATES_SQL,
      [since, sppgId, demoMode],
    );
    return {
      candidates: Object.freeze(
        rows.map((row) =>
          Object.freeze({
            sppgId: row.sppgId,
            manualCount: row.manualCount,
            isDemo: row.isDemo,
          }),
        ),
      ),
      total: countRow?.total ?? 0,
    };
  }

  async samples(
    sppgId: string,
    since: Date,
    limit: number,
  ): Promise<readonly AnalyticsSample[]> {
    const rows = await this.dataSource.query<SampleRow[]>(SAMPLES_SQL, [
      sppgId,
      since,
      limit,
    ]);
    return Object.freeze(
      rows
        .map((row) =>
          toAnalyticsSample(
            row.batchId,
            row.beratKg,
            row.waktuKejadian,
            row.deviceId !== null,
          ),
        )
        .reverse(),
    );
  }
}