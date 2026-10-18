import {
  DIGIT_REASONS,
  type AnalyticsResponse,
  type DigitAnalysis,
  type DigitReason,
  type DigitSampleRef,
} from './analytics.contract.js';

const MAX_DIGIT_SAMPLES = 1000;
const MAX_TEXT = 128;
const MAX_COUNT = 100000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isFiniteWithin = (
  value: unknown,
  min: number,
  max: number,
): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;

const isCount = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= MAX_COUNT;

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT;

const isNullableText = (value: unknown): value is string | null =>
  value === null || isText(value);

const isDigitReason = (value: unknown): value is DigitReason =>
  typeof value === 'string' &&
  (DIGIT_REASONS as readonly string[]).includes(value);

const parseDigitSample = (value: unknown): DigitSampleRef | null => {
  if (!isRecord(value)) return null;
  const { batchId, weightKg } = value;
  if (!isText(batchId)) return null;
  if (!isFiniteWithin(weightKg, 0, 500)) return null;
  return Object.freeze({ batchId, weightKg });
};

const parseAnalysis = (value: unknown): DigitAnalysis | null => {
  if (!isRecord(value)) return null;
  if (value.mode !== 'digit') return null;
  if (!isText(value.rule)) return null;
  if (!isText(value.sppgId)) return null;
  if (!isText(value.dateFrom) || !isText(value.dateTo)) return null;
  if (!isCount(value.sampleCount) || !isCount(value.digitCount)) return null;
  if (value.digitCount > value.sampleCount) return null;
  if (!isFiniteWithin(value.proportion, 0, 1)) return null;
  if (value.threshold !== null && !isFiniteWithin(value.threshold, 0, 1)) {
    return null;
  }
  if (!isCount(value.sampleSize) || value.sampleSize < 1) return null;
  if (!isCount(value.sampleMin) || value.sampleMin < 1) return null;
  if (typeof value.flagged !== 'boolean') return null;
  if (!isDigitReason(value.reason)) return null;
  if (!isCount(value.excludedDeviceCount)) return null;
  if (!isNullableText(value.windowStart)) return null;
  if (!isNullableText(value.windowEnd)) return null;
  if (
    !Array.isArray(value.digitSamples) ||
    value.digitSamples.length > MAX_DIGIT_SAMPLES
  ) {
    return null;
  }
  const digitSamples: DigitSampleRef[] = [];
  for (const entry of value.digitSamples) {
    const ref = parseDigitSample(entry);
    if (ref === null) return null;
    digitSamples.push(ref);
  }
  if (value.flagged !== (value.reason === 'PROPORSI_DIGIT_TINGGI')) return null;
  const shortSample = value.sampleCount < value.sampleMin;
  if (shortSample !== (value.reason === 'SAMPEL_KURANG')) return null;
  const thresholdRequired =
    value.reason === 'PROPORSI_DIGIT_TINGGI' || value.reason === 'DALAM_AMBANG';
  if (thresholdRequired && value.threshold === null) return null;
  if (
    value.reason === 'AMBANG_BELUM_TERKALIBRASI' &&
    value.threshold !== null
  ) {
    return null;
  }
  return Object.freeze({
    mode: 'digit' as const,
    rule: value.rule,
    sppgId: value.sppgId,
    dateFrom: value.dateFrom,
    dateTo: value.dateTo,
    sampleCount: value.sampleCount,
    digitCount: value.digitCount,
    proportion: value.proportion,
    threshold: value.threshold === null ? null : value.threshold,
    sampleSize: value.sampleSize,
    sampleMin: value.sampleMin,
    flagged: value.flagged,
    reason: value.reason,
    excludedDeviceCount: value.excludedDeviceCount,
    windowStart: value.windowStart,
    windowEnd: value.windowEnd,
    digitSamples: Object.freeze(digitSamples),
  });
};

export const parseAnalyticsResponse = (
  value: unknown,
): AnalyticsResponse | null => {
  if (!isRecord(value)) return null;
  const analysis = parseAnalysis(value.analysis);
  if (analysis === null) return null;
  return Object.freeze({ analysis });
};