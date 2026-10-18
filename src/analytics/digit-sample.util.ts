import type {
  AnalyticsRequest,
  AnalyticsSample,
  DigitAnalysis,
} from './analytics.contract.js';

export interface SppgCandidate {
  readonly sppgId: string;
  readonly manualCount: number;
  readonly isDemo: boolean;
}

export interface InsufficientSppg {
  readonly sppgId: string;
  readonly manualCount: number;
}

export interface CandidateSplit {
  readonly eligible: readonly SppgCandidate[];
  readonly insufficient: readonly InsufficientSppg[];
}

export interface DigitRequestInput {
  readonly sppgId: string;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly threshold: number | null;
  readonly sampleSize: number;
  readonly sampleMin: number;
  readonly samples: readonly AnalyticsSample[];
}

export const splitCandidates = (
  candidates: readonly SppgCandidate[],
  sampleMin: number,
): CandidateSplit => {
  const eligible: SppgCandidate[] = [];
  const insufficient: InsufficientSppg[] = [];
  for (const candidate of candidates) {
    if (candidate.manualCount >= sampleMin) {
      eligible.push(candidate);
    } else {
      insufficient.push(
        Object.freeze({
          sppgId: candidate.sppgId,
          manualCount: candidate.manualCount,
        }),
      );
    }
  }
  return Object.freeze({
    eligible: Object.freeze(eligible),
    insufficient: Object.freeze(insufficient),
  });
};

export const buildDigitRequest = (input: DigitRequestInput): AnalyticsRequest =>
  Object.freeze({
    sppgId: input.sppgId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    mode: 'digit' as const,
    samples: Object.freeze(
      [...input.samples].sort(
        (left, right) =>
          Date.parse(left.occurredAt) - Date.parse(right.occurredAt),
      ),
    ),
    options: Object.freeze({
      ...(input.threshold === null ? {} : { threshold: input.threshold }),
      sampleSize: input.sampleSize,
      sampleMin: input.sampleMin,
    }),
  });

export const shouldFlag = (analysis: DigitAnalysis): boolean =>
  analysis.flagged;

export const shouldAutoClose = (analysis: DigitAnalysis): boolean =>
  analysis.sampleCount >= analysis.sampleMin &&
  analysis.threshold !== null &&
  !analysis.flagged;

export const autoCloseNote = (analysis: DigitAnalysis): string =>
  `Pemindaian ulang: proporsi digit ${(analysis.proportion * 100).toFixed(2)}% pada ${analysis.sampleCount} sampel, di bawah ambang ${((analysis.threshold ?? 0) * 100).toFixed(2)}%`;

export const digitAnomalyDetail = (
  analysis: DigitAnalysis,
): Record<string, unknown> =>
  Object.freeze({
    rule: analysis.rule,
    sampleCount: analysis.sampleCount,
    digitCount: analysis.digitCount,
    proportion: analysis.proportion,
    threshold: analysis.threshold,
    sampleSize: analysis.sampleSize,
    sampleMin: analysis.sampleMin,
    window: Object.freeze({
      dateFrom: analysis.dateFrom,
      dateTo: analysis.dateTo,
      sampleFrom: analysis.windowStart,
      sampleTo: analysis.windowEnd,
    }),
    excludedDeviceCount: analysis.excludedDeviceCount,
    digitSamples: analysis.digitSamples,
  });