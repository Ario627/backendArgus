import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfiguration } from '../config/configuration.js';
import { OpsNotifierService } from '../ops/ops-notifier.service.js';
import { StorageService } from '../photo/storage.service.js';
import { resolveRetentionWindows } from './retention-policy.util.js';

const RETENTION_CRON = '30 2 * * *';
const WIB_TIMEZONE = 'Asia/Jakarta';

const POLICY_DAYS_SQL = `
SELECT COALESCE(
         EXTRACT(epoch FROM (config ->> 'compress_after')::interval) / 86400,
         0
       )::int AS days
  FROM timescaledb_information.jobs
 WHERE hypertable_name = 'telemetry'
   AND proc_name IN ('policy_compression', 'policy_hypercore')
 LIMIT 1`;

const REMOVE_POLICY_SQL =
  "CALL remove_columnstore_policy('telemetry', if_exists => TRUE)";

const ADD_POLICY_SQL =
  "CALL add_columnstore_policy('telemetry', after => make_interval(days => $1::int), if_not_exists => TRUE)";

const DROP_CHUNKS_SQL =
  "SELECT count(*)::int AS dropped FROM drop_chunks('telemetry', older_than => make_interval(days => $1::int))";

const PHOTO_CANDIDATES_SQL = `
SELECT sha256, ref_tipe
  FROM foto
 WHERE (ref_tipe = 'tiket'
        AND created_at < now() - make_interval(days => $1::int))
    OR (ref_tipe IN ('batch', 'ledger_event', 'lainnya')
        AND created_at < now() - make_interval(days => $2::int))
 ORDER BY created_at ASC
 LIMIT $3`;

const DELETE_PHOTO_SQL = `
WITH removed AS (
  DELETE FROM foto WHERE sha256 = $1 RETURNING sha256
)
SELECT sha256 FROM removed`;

export interface RetentionRunReport {
  readonly ranAt: string;
  readonly purgeEnabled: boolean;
  readonly telemetryBefore: string;
  readonly photoTicketBefore: string;
  readonly photoBatchBefore: string;
  readonly compressAfterDays: number;
  readonly compressPolicyChanged: boolean;
  readonly telemetryChunksDropped: number;
  readonly photoCandidates: number;
  readonly photosDeleted: number;
  readonly failures: number;
  readonly skipped: boolean;
}

interface PolicyRow {
  readonly days: number;
}

interface DroppedRow {
  readonly dropped: number;
}

interface PhotoRow {
  readonly sha256: string;
  readonly ref_tipe: string;
}

interface RemovedRow {
  readonly sha256: string;
}

interface PurgeOutcome {
  readonly candidates: number;
  readonly deleted: number;
  readonly failures: number;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private readonly compressAfterDays: number;
  private readonly dropAfterDays: number;
  private readonly photoTicketDays: number;
  private readonly photoBatchDays: number;
  private readonly maxPhotosPerRun: number;
  private readonly purgeEnabled: boolean;
  private running = false;

  constructor(
    configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly opsNotifier: OpsNotifierService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.compressAfterDays = config.retention.compressAfterDays;
    this.dropAfterDays = config.retention.dropAfterDays;
    this.photoTicketDays = config.retention.photoTicketDays;
    this.photoBatchDays = config.retention.photoBatchDays;
    this.maxPhotosPerRun = config.retention.maxPhotosPerRun;
    this.purgeEnabled = config.retention.purgeEnabled;
  }

  @Cron(RETENTION_CRON, {
    name: 'retention-daily',
    timeZone: WIB_TIMEZONE,
    waitForCompletion: true,
  })
  async runDaily(): Promise<void> {
    const report = await this.run();
    if (report.skipped) {
      this.logger.warn('retensi harian dilewati: proses lain berjalan');
      return;
    }
    this.logger.log(
      `retensi harian: chunk_telemetri=${report.telemetryChunksDropped} foto_kandidat=${report.photoCandidates} foto_dihapus=${report.photosDeleted} gagal=${report.failures} dry_run=${!report.purgeEnabled}`,
    );
  }

  async run(): Promise<RetentionRunReport> {
    if (this.running) {
      return Object.freeze({
        ranAt: new Date().toISOString(),
        purgeEnabled: this.purgeEnabled,
        telemetryBefore: '',
        photoTicketBefore: '',
        photoBatchBefore: '',
        compressAfterDays: this.compressAfterDays,
        compressPolicyChanged: false,
        telemetryChunksDropped: 0,
        photoCandidates: 0,
        photosDeleted: 0,
        failures: 0,
        skipped: true,
      });
    }
    this.running = true;
    try {
      return await this.execute();
    } finally {
      this.running = false;
    }
  }

  private async execute(): Promise<RetentionRunReport> {
    const windows = resolveRetentionWindows({
      now: new Date(),
      dropAfterDays: this.dropAfterDays,
      photoTicketDays: this.photoTicketDays,
      photoBatchDays: this.photoBatchDays,
    });
    const compressPolicyChanged = await this.alignColumnstorePolicy();
    const telemetryChunksDropped = await this.dropTelemetryChunks();
    const purge = await this.purgePhotos();
    const report: RetentionRunReport = Object.freeze({
      ranAt: new Date().toISOString(),
      purgeEnabled: this.purgeEnabled,
      telemetryBefore: windows.telemetryBefore.toISOString(),
      photoTicketBefore: windows.photoTicketBefore.toISOString(),
      photoBatchBefore: windows.photoBatchBefore.toISOString(),
      compressAfterDays: this.compressAfterDays,
      compressPolicyChanged,
      telemetryChunksDropped,
      photoCandidates: purge.candidates,
      photosDeleted: purge.deleted,
      failures: purge.failures,
      skipped: false,
    });
    await this.finalize(report);
    return report;
  }

  private async alignColumnstorePolicy(): Promise<boolean> {
    try {
      const rows = await this.dataSource.query<PolicyRow[]>(
        POLICY_DAYS_SQL,
        [],
      );
      if (rows[0]?.days === this.compressAfterDays) {
        return false;
      }
      await this.dataSource.query(REMOVE_POLICY_SQL, []);
      await this.dataSource.query(ADD_POLICY_SQL, [this.compressAfterDays]);
      return true;
    } catch (error) {
      this.logger.error(
        'penyesuaian kebijakan columnstore gagal',
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  private async dropTelemetryChunks(): Promise<number> {
    try {
      const rows = await this.dataSource.query<DroppedRow[]>(DROP_CHUNKS_SQL, [
        this.dropAfterDays,
      ]);
      return rows[0]?.dropped ?? 0;
    } catch (error) {
      this.logger.error(
        'pemangkasan chunk telemetri gagal',
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    }
  }

  private async purgePhotos(): Promise<PurgeOutcome> {
    const candidates = await this.dataSource.query<PhotoRow[]>(
      PHOTO_CANDIDATES_SQL,
      [this.photoTicketDays, this.photoBatchDays, this.maxPhotosPerRun],
    );
    if (!this.purgeEnabled) {
      return { candidates: candidates.length, deleted: 0, failures: 0 };
    }
    let deleted = 0;
    let failures = 0;
    for (const photo of candidates) {
      try {
        await this.storageService.delete(photo.sha256);
        const removed = await this.dataSource.query<RemovedRow[]>(
          DELETE_PHOTO_SQL,
          [photo.sha256],
        );
        if (removed.length > 0) {
          deleted += 1;
        }
      } catch (error) {
        failures += 1;
        this.logger.warn(
          `penghapusan foto ${photo.sha256.slice(0, 12)} gagal: ${error instanceof Error ? error.message : 'non-error'}`,
        );
      }
    }
    return { candidates: candidates.length, deleted, failures };
  }

  private async finalize(report: RetentionRunReport): Promise<void> {
    await this.auditService.record({
      aktor: null,
      aktorPeran: null,
      aksi: 'retention.run',
      entitas: 'retention',
      entitasId: null,
      detail: {
        purgeEnabled: report.purgeEnabled,
        compressAfterDays: report.compressAfterDays,
        compressPolicyChanged: report.compressPolicyChanged,
        telemetryChunksDropped: report.telemetryChunksDropped,
        photoCandidates: report.photoCandidates,
        photosDeleted: report.photosDeleted,
        failures: report.failures,
      },
      requestId: null,
    });
    if (report.failures === 0) {
      return;
    }
    await this.opsNotifier.notify({
      type: 'retention_failed',
      severity: 'WARNING',
      message: `retensi: ${report.failures} foto gagal dihapus`,
      detail: {
        photoCandidates: report.photoCandidates,
        photosDeleted: report.photosDeleted,
        failures: report.failures,
      },
    });
  }
}