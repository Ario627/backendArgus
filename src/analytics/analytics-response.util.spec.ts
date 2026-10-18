import { describe, expect, it } from '@jest/globals';
import { parseAnalyticsResponse } from './analytics-response.util.js';

const analysis = {
  mode: 'digit',
  rule: 'LAST_CENTIGRAM_0_OR_5',
  sppgId: 'sppg-1',
  dateFrom: '2026-07-20',
  dateTo: '2026-10-18',
  sampleCount: 30,
  digitCount: 12,
  proportion: 0.4,
  threshold: 0.3,
  sampleSize: 30,
  sampleMin: 30,
  flagged: true,
  reason: 'PROPORSI_DIGIT_TINGGI',
  excludedDeviceCount: 3,
  windowStart: '2026-10-01T01:00:00+00:00',
  windowEnd: '2026-10-02T05:00:00+00:00',
  digitSamples: [{ batchId: 'b1', weightKg: 12.5 }],
};

const withAnalysis = (patch: Record<string, unknown>) => ({
  analysis: { ...analysis, ...patch },
});

describe('parseAnalyticsResponse', () => {
  it('menerima respons lengkap', () => {
    const parsed = parseAnalyticsResponse(withAnalysis({}));
    expect(parsed?.analysis.proportion).toBe(0.4);
    expect(parsed?.analysis.flagged).toBe(true);
    expect(parsed?.analysis.digitSamples).toHaveLength(1);
  });

  it('menerima ambang null beserta alasan belum terkalibrasi', () => {
    const parsed = parseAnalyticsResponse(
      withAnalysis({
        threshold: null,
        flagged: false,
        reason: 'AMBANG_BELUM_TERKALIBRASI',
      }),
    );
    expect(parsed?.analysis.threshold).toBeNull();
    expect(parsed?.analysis.reason).toBe('AMBANG_BELUM_TERKALIBRASI');
  });

  it('menolak nilai bukan objek', () => {
    expect(parseAnalyticsResponse(null)).toBeNull();
    expect(parseAnalyticsResponse([])).toBeNull();
    expect(parseAnalyticsResponse('x')).toBeNull();
  });

  it('menolak mode selain digit', () => {
    expect(parseAnalyticsResponse(withAnalysis({ mode: 'campuran' }))).toBeNull();
  });

  it('menolak proporsi di luar 0..1', () => {
    expect(parseAnalyticsResponse(withAnalysis({ proportion: 1.2 }))).toBeNull();
    expect(parseAnalyticsResponse(withAnalysis({ proportion: -0.1 }))).toBeNull();
  });

  it('menolak digitCount melebihi sampleCount', () => {
    expect(
      parseAnalyticsResponse(withAnalysis({ digitCount: 31 })),
    ).toBeNull();
  });

  it('menolak flagged yang tidak sinkron dengan alasan', () => {
    expect(
      parseAnalyticsResponse(withAnalysis({ flagged: false })),
    ).toBeNull();
    expect(
      parseAnalyticsResponse(
        withAnalysis({ reason: 'DALAM_AMBANG', flagged: true }),
      ),
    ).toBeNull();
  });

  it('menolak alasan sampel kurang bila sampel justru cukup', () => {
    expect(
      parseAnalyticsResponse(
        withAnalysis({ reason: 'SAMPEL_KURANG', flagged: false }),
      ),
    ).toBeNull();
  });

  it('menolak keputusan yang butuh ambang tanpa ambang', () => {
    expect(
      parseAnalyticsResponse(withAnalysis({ threshold: null })),
    ).toBeNull();
    expect(
      parseAnalyticsResponse(
        withAnalysis({ threshold: null, flagged: false, reason: 'DALAM_AMBANG' }),
      ),
    ).toBeNull();
  });

  it('menolak klaim belum terkalibrasi padahal ambang ada', () => {
    expect(
      parseAnalyticsResponse(
        withAnalysis({ reason: 'AMBANG_BELUM_TERKALIBRASI', flagged: false }),
      ),
    ).toBeNull();
  });

  it('menerima sampel kurang dengan sampleCount kecil', () => {
    const parsed = parseAnalyticsResponse(
      withAnalysis({
        sampleCount: 8,
        digitCount: 2,
        reason: 'SAMPEL_KURANG',
        flagged: false,
        proportion: 0.25,
      }),
    );
    expect(parsed?.analysis.reason).toBe('SAMPEL_KURANG');
  });

  it('menolak alasan tak dikenal', () => {
    expect(
      parseAnalyticsResponse(withAnalysis({ reason: 'AKAL_AKALAN' })),
    ).toBeNull();
  });

  it('menolak angka bukan bilangan bulat pada hitungan', () => {
    expect(parseAnalyticsResponse(withAnalysis({ sampleCount: 3.5 }))).toBeNull();
    expect(
      parseAnalyticsResponse(withAnalysis({ excludedDeviceCount: -1 })),
    ).toBeNull();
  });

  it('menolak sampel digit yang bentuknya salah', () => {
    expect(
      parseAnalyticsResponse(
        withAnalysis({ digitSamples: [{ batchId: 'b1', weightKg: '12.5' }] }),
      ),
    ).toBeNull();
    expect(
      parseAnalyticsResponse(withAnalysis({ digitSamples: [{ batchId: '' }] })),
    ).toBeNull();
  });

  it('menolak teks kosong pada jendela sampel', () => {
    expect(parseAnalyticsResponse(withAnalysis({ windowStart: '' }))).toBeNull();
  });
});