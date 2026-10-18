import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AnomalyKind } from '../common/constant/domain.constant.js';
import { generateId } from '../common/utils/id.util.js';
import type { AnomalyReport } from '../ledger/ledger-verify.types.js';
import { OpsNotifierService } from '../ops/ops-notifier.service.js';
import { groupAnomalies } from './anomaly-group.util.js';

const UPSERT_SQL = `
INSERT INTO anomali (id, batch_id, jenis, tingkat, detail, is_demo)
VALUES ($1, $2, $3, $4, $5::jsonb, $6)
ON CONFLICT (batch_id, jenis) WHERE ditutup_at IS NULL
DO UPDATE SET tingkat = EXCLUDED.tingkat, detail = EXCLUDED.detail
RETURNING (xmax = 0) AS inserted`;

const UPSERT_SPPG_SQL = `
INSERT INTO anomali (id, sppg_id, jenis, tingkat, detail, is_demo)
VALUES ($1, $2, $3, $4, $5::jsonb, $6)
ON CONFLICT (sppg_id, jenis) WHERE ditutup_at IS NULL
DO UPDATE SET tingkat = EXCLUDED.tingkat, detail = EXCLUDED.detail
RETURNING (xmax = 0) AS inserted`;

const CLOSE_SPPG_SQL = `
WITH closed AS (
  UPDATE anomali
     SET ditutup_at = now(),
         ditutup_oleh = $3,
         detail = jsonb_set(detail, '{penutupan}', $4::jsonb, TRUE)
   WHERE sppg_id = $1
     AND jenis = $2
     AND ditutup_at IS NULL
  RETURNING id
)
SELECT count(*)::int AS total FROM closed`;

interface UpsertRow {
  readonly inserted: boolean;
}

interface CountRow {
  readonly total: number;
}

@Injectable()
export class AnomalyWriterService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly opsNotifier: OpsNotifierService,
  ) {}

  async persist(
    batchId: string,
    isDemo: boolean,
    reports: readonly AnomalyReport[],
  ): Promise<number> {
    if (reports.length === 0) return 0;
    const grouped = groupAnomalies(reports);
    for (const group of grouped) {
      const rows = await this.dataSource.query<UpsertRow[]>(UPSERT_SQL, [
        generateId(),
        batchId,
        group.jenis,
        group.tingkat,
        JSON.stringify({ items: group.items }),
        isDemo,
      ]);
      if (group.tingkat === 'KRITIS' && rows[0]?.inserted === true) {
        void this.opsNotifier.notify({
          type: 'anomaly_critical',
          severity: 'CRITICAL',
          message: `anomali KRITIS baru: ${group.jenis}`,
          detail: { batchId, jenis: group.jenis },
        });
      }
    }
    return grouped.length;
  }

  async persistSppgScope(
    sppgId: string,
    isDemo: boolean,
    jenis: AnomalyKind,
    detail: Record<string, unknown>,
  ): Promise<boolean> {
    const rows = await this.dataSource.query<UpsertRow[]>(UPSERT_SPPG_SQL, [
      generateId(),
      sppgId,
      jenis,
      'INFO',
      JSON.stringify(detail),
      isDemo,
    ]);
    return rows[0]?.inserted === true;
  }

  async closeSppgScope(
    sppgId: string,
    jenis: AnomalyKind,
    actorId: string,
    note: string,
    detail: Record<string, unknown>,
  ): Promise<number> {
    const penutupan = {
      catatan: note,
      oleh: actorId,
      at: new Date().toISOString(),
      otomatis: true,
      ringkasan: detail,
    };
    const [row] = await this.dataSource.query<CountRow[]>(CLOSE_SPPG_SQL, [
      sppgId,
      jenis,
      actorId,
      JSON.stringify(penutupan),
    ]);
    return row?.total ?? 0;
  }
}
