import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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

interface UpsertRow {
  readonly inserted: boolean;
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
}
