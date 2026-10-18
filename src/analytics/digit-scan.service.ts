import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfiguration } from '../config/configuration.js';
import {
  jakartaDateOf,
  wibDayRangeUtc,
} from '../common/utils/daily-range.util.js';
import { AnomalyWriterService } from '../anomaly/anomaly-writer.service.js';
import { ParameterService } from '../parameter/parameter.service.js';
import { AnalyticsClient } from './analytics.client.js';
import type { DigitAnalysis, DigitReason } from './analytics.contract.js';
import {
  analyticsScanEmptyError,
  analyticsUnavailableError,
} from './analytics.errors.js';
import { DigitSampleService } from './digit-sample.service.js';
import {
  autoCloseNote,
  buildDigitRequest,
  digitAnomalyDetail,
  shouldAutoClose,
  shouldFlag,
  splitCandidates,
  type InsufficientSppg,
} from './digit-sample.util.js';
import type { DigitScanDto } from './dto/digit-scan.dto.js';

const DIGIT_ANOMALY_KIND = 'DIGIT_TIDAK_WAJAR';
const SAMPLE_ROW_MULTIPLIER = 4;
const DAY_MS = 86400000;

export interface DigitScanEntry {
  readonly sppgId: string;
  readonly reason: DigitReason;
  readonly flagged: boolean;
  readonly sampleCount: number;
  readonly digitCount: number;
  readonly proportion: number;
  readonly threshold: number | null;
  readonly persisted: boolean;
  readonly closed: number;
}

export interface DigitScanFailure {
  readonly sppgId: string;
  readonly reason: string;
}

export interface DigitScanResult {
  readonly status: 'OK' | 'PARTIAL';
  readonly window: {
    readonly dateFrom: string;
    readonly dateTo: string;
    readonly lookbackDays: number;
  };
  readonly threshold: number | null;
  readonly sampleSize: number;
  readonly sampleMin: number;
  readonly scanned: number;
  readonly insufficient: readonly InsufficientSppg[];
  readonly failures: readonly DigitScanFailure[];
  readonly entries: readonly DigitScanEntry[];
}

interface ResolvedScan {
  readonly since: Date;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly lookbackDays: number;
  readonly sampleSize: number;
  readonly sampleMin: number;
}

@Injectable()
export class DigitScanService {
  private readonly logger = new Logger(DigitScanService.name);
  private readonly demoMode: boolean;
  private readonly defaultLookbackDays: number;
  private readonly maxSppgPerScan: number;

  constructor(
    configService: ConfigService,
    private readonly samples: DigitSampleService,
    private readonly analyticsClient: AnalyticsClient,
    private readonly parameterService: ParameterService,
    private readonly anomalyWriter: AnomalyWriterService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.demoMode = config.demoMode;
    this.defaultLookbackDays = config.analytics.lookbackDays;
    this.maxSppgPerScan = config.analytics.maxSppgPerScan;
  }

  private resolveScan(
    dto: DigitScanDto,
    config: AppConfiguration,
  ): ResolvedScan {
    const lookbackDays = dto.lookbackDays ?? this.defaultLookbackDays;
    const now = new Date();
    const dateTo = jakartaDateOf(now);
    const dateFrom = jakartaDateOf(
      new Date(now.getTime() - lookbackDays * DAY_MS),
    );
    return {
      since: wibDayRangeUtc(dateFrom).start,
      dateFrom,
      dateTo,
      lookbackDays,
      sampleSize: config.analytics.sampleSize,
      sampleMin: config.analytics.sampleMin,
    };
  }

  private async resolveThreshold(): Promise<number | null> {
    const reading = await this.parameterService.getValue(
      'ambang_proporsi_digit',
    );
    if (reading === null || reading.nilai === null) return null;
    if (reading.nilai <= 0 || reading.nilai > 1) {
      this.logger.warn(
        `parameter ambang_proporsi_digit di luar 0..1 (${reading.nilai}), diabaikan`,
      );
      return null;
    }
    return reading.nilai;
  }

  private async analyzeOne(
    sppgId: string,
    scan: ResolvedScan,
    threshold: number | null,
    isDemo: boolean,
  ): Promise<DigitAnalysis | null> {
    const rows = await this.samples.samples(
      sppgId,
      scan.since,
      scan.sampleSize * SAMPLE_ROW_MULTIPLIER,
    );
    if (rows.length === 0) return null;
    const response = await this.analyticsClient.analyze(
      buildDigitRequest({
        sppgId,
        dateFrom: scan.dateFrom,
        dateTo: scan.dateTo,
        threshold,
        sampleSize: scan.sampleSize,
        sampleMin: scan.sampleMin,
        samples: rows,
      }),
    );
    if (response === null) return null;
    return response.analysis;
  }

  private async settle(
    analysis: DigitAnalysis,
    actorId: string,
    isDemo: boolean,
  ): Promise<{ persisted: boolean; closed: number }> {
    if (shouldFlag(analysis)) {
      const persisted = await this.anomalyWriter.persistSppgScope(
        analysis.sppgId,
        isDemo,
        DIGIT_ANOMALY_KIND,
        digitAnomalyDetail(analysis),
      );
      return { persisted, closed: 0 };
    }
    if (!shouldAutoClose(analysis)) return { persisted: false, closed: 0 };
    const closed = await this.anomalyWriter.closeSppgScope(
      analysis.sppgId,
      DIGIT_ANOMALY_KIND,
      actorId,
      autoCloseNote(analysis),
      digitAnomalyDetail(analysis),
    );
    return { persisted: false, closed };
  }

  async scan(
    dto: DigitScanDto,
    actorId: string,
    config: AppConfiguration,
  ): Promise<DigitScanResult> {
    const scan = this.resolveScan(dto, config);
    const threshold = await this.resolveThreshold();
    const page = await this.samples.candidates(
      scan.since,
      dto.sppgId ?? null,
      this.maxSppgPerScan,
      0,
      this.demoMode,
    );
    if (page.candidates.length === 0) throw analyticsScanEmptyError();
    const { eligible, insufficient } = splitCandidates(
      page.candidates,
      scan.sampleMin,
    );

    const entries: DigitScanEntry[] = [];
    const failures: DigitScanFailure[] = [];
    for (const candidate of eligible) {
      const analysis = await this.analyzeOne(
        candidate.sppgId,
        scan,
        threshold,
        candidate.isDemo,
      );
      if (analysis === null) {
        failures.push(
          Object.freeze({
            sppgId: candidate.sppgId,
            reason: 'ANALYTICS_TIDAK_TERSEDIA',
          }),
        );
        continue;
      }
      const settled = await this.settle(analysis, actorId, candidate.isDemo);
      entries.push(
        Object.freeze({
          sppgId: analysis.sppgId,
          reason: analysis.reason,
          flagged: analysis.flagged,
          sampleCount: analysis.sampleCount,
          digitCount: analysis.digitCount,
          proportion: analysis.proportion,
          threshold: analysis.threshold,
          persisted: settled.persisted,
          closed: settled.closed,
        }),
      );
    }

    if (entries.length === 0 && eligible.length > 0) {
      throw analyticsUnavailableError();
    }

    this.logger.log(
      `pemindaian digit: ${entries.length} dapur, ${entries.filter((entry) => entry.flagged).length} ditandai, ${failures.length} gagal`,
    );
    return Object.freeze({
      status: failures.length === 0 ? ('OK' as const) : ('PARTIAL' as const),
      window: Object.freeze({
        dateFrom: scan.dateFrom,
        dateTo: scan.dateTo,
        lookbackDays: scan.lookbackDays,
      }),
      threshold,
      sampleSize: scan.sampleSize,
      sampleMin: scan.sampleMin,
      scanned: entries.length,
      insufficient,
      failures: Object.freeze(failures),
      entries: Object.freeze(entries),
    });
  }
}