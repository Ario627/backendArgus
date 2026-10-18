export const ANALYTICS_MODES = Object.freeze(['digit'] as const);
export type AnalyticsMode = (typeof ANALYTICS_MODES)[number];

export const DIGIT_REASONS = Object.freeze([
  'SAMPEL_KURANG',
  'AMBANG_BELUM_TERKALIBRASI',
  'PROPORSI_DIGIT_TINGGI',
  'DALAM_AMBANG',
] as const);
export type DigitReason = (typeof DIGIT_REASONS)[number];

export type SampleOrigin = 'manual' | 'device';

export interface AnalyticsSample {
  readonly batchId: string;
  readonly weightKg: number;
  readonly occurredAt: string;
  readonly origin: SampleOrigin;
}

export interface AnalyticsOptions {
  readonly threshold?: number;
  readonly sampleSize?: number;
  readonly sampleMin?: number;
}

export interface AnalyticsRequest {
  readonly sppgId: string;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly mode: AnalyticsMode;
  readonly samples: readonly AnalyticsSample[];
  readonly options?: AnalyticsOptions;
}

export interface DigitSampleRef {
  readonly batchId: string;
  readonly weightKg: number;
}

export interface DigitAnalysis {
  readonly mode: 'digit';
  readonly rule: string;
  readonly sppgId: string;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly sampleCount: number;
  readonly digitCount: number;
  readonly proportion: number;
  readonly threshold: number | null;
  readonly sampleSize: number;
  readonly sampleMin: number;
  readonly flagged: boolean;
  readonly reason: DigitReason;
  readonly excludedDeviceCount: number;
  readonly windowStart: string | null;
  readonly windowEnd: string | null;
  readonly digitSamples: readonly DigitSampleRef[];
}

export interface AnalyticsResponse {
  readonly analysis: DigitAnalysis;
}