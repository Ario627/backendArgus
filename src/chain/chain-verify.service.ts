import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import { jakartaDateOf } from '../common/utils/daily-range.util.js';
import type { AppConfiguration } from '../config/configuration.js';
import { LedgerVerifyService } from '../ledger/ledger-verify.service.js';
import { OpsNotifierService } from '../ops/ops-notifier.service.js';
import {
  resolveSweepPlan,
  SWEEP_IDS_SQL,
  type SweepPlan,
} from './chain-sweep.util.js';

const BREACH_SAMPLE_LIMIT = 20;
const CHAIN_SWEEP_CRON = '0 4 * * *';
const WIB_TIMEZONE = 'Asia/Jakarta';

export interface ChainSweepReport {
  readonly checkedAt: string;
  readonly checked: number;
  readonly failed: number;
  readonly errors: number;
  readonly breachBatchIds: readonly string[];
  readonly skipped: boolean;
}

interface IdRow {
  readonly id: string;
}

@Injectable()
export class ChainVerifyService {
  private readonly logger = new Logger(ChainVerifyService.name);
  private readonly plan: SweepPlan;
  private readonly samplePercent: number;
  private running = false;

  constructor(
    configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledgerVerifyService: LedgerVerifyService,
    private readonly auditService: AuditService,
    private readonly opsNotifier: OpsNotifierService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.plan = resolveSweepPlan({
      dailyBatches: config.chain.verifyDailyBatches,
    });
    this.samplePercent = config.chain.verifySamplePercent;
  }

  @Cron(CHAIN_SWEEP_CRON, {
    name: 'chain-verify-daily',
    timeZone: WIB_TIMEZONE,
    waitForCompletion: true,
  })
  async runDaily(): Promise<void> {
    const report = await this.sweep();
    if (report.skipped) {
      this.logger.warn(
        'verifikasi rantai harian dilewati: proses lain berjalan',
      );
      return;
    }
    this.logger.log(
      `verifikasi rantai harian: diperiksa=${report.checked} timpa=${report.failed} galat=${report.errors}`,
    );
  }

  async sweep(): Promise<ChainSweepReport> {
    if (this.running) {
      return Object.freeze({
        checkedAt: new Date().toISOString(),
        checked: 0,
        failed: 0,
        errors: 0,
        breachBatchIds: Object.freeze([]),
        skipped: true,
      });
    }
    this.running = true;
    try {
      return await this.runSweep();
    } finally {
      this.running = false;
    }
  }

  private async runSweep(): Promise<ChainSweepReport> {
    const seed = jakartaDateOf(new Date());
    const rows = await this.dataSource.query<IdRow[]>(SWEEP_IDS_SQL, [
      this.plan.newest,
      this.samplePercent,
      seed,
      this.plan.sampleCapacity,
    ]);
    let failed = 0;
    let errors = 0;
    const breachBatchIds: string[] = [];
    for (const row of rows) {
      try {
        const report = await this.ledgerVerifyService.verifyBatch(row.id);
        if (!report.chainOk) {
          failed += 1;
          breachBatchIds.push(row.id);
        }
      } catch (error) {
        errors += 1;
        this.logger.error(
          `verifikasi batch ${row.id} gagal`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    const report: ChainSweepReport = Object.freeze({
      checkedAt: new Date().toISOString(),
      checked: rows.length,
      failed,
      errors,
      breachBatchIds: Object.freeze(
        breachBatchIds.slice(0, BREACH_SAMPLE_LIMIT),
      ),
      skipped: false,
    });
    await this.finalize(report, seed);
    return report;
  }

  private async finalize(
    report: ChainSweepReport,
    seed: string,
  ): Promise<void> {
    await this.auditService.record({
      aktor: null,
      aktorPeran: null,
      aksi: 'chain.verify.sweep',
      entitas: 'ledger',
      entitasId: null,
      detail: {
        checked: report.checked,
        failed: report.failed,
        errors: report.errors,
        breachBatchIds: report.breachBatchIds,
        seed,
      },
      requestId: null,
    });
    if (report.failed === 0 && report.errors === 0) {
      return;
    }
    await this.opsNotifier.notify({
      type: 'chain_verify_failed',
      severity: report.failed > 0 ? 'CRITICAL' : 'WARNING',
      message: `verifikasi rantai: ${report.failed} batch timpa, ${report.errors} galat`,
      detail: {
        checked: report.checked,
        failed: report.failed,
        errors: report.errors,
        breachBatchIds: report.breachBatchIds,
      },
    });
  }
}