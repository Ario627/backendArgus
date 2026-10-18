import { describe, expect, it } from '@jest/globals';
import type { AnalyticsSample, DigitAnalysis } from './analytics.contract.js';
import {
  autoCloseNote,
  buildDigitRequest,
  digitAnomalyDetail,
  shouldAutoClose,
  shouldFlag,
  splitCandidates,
} from './digit-sample.util.js';

const sample = (batchId: string, occurredAt: string): AnalyticsSample => ({
  batchId,
  weightKg: 12.5,
  occurredAt,
  origin: 'manual',
});

const analysis = (patch: Partial<DigitAnalysis> = {}): DigitAnalysis => ({
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
  excludedDeviceCount: 0,
  windowStart: '2026-10-01T01:00:00Z',
  windowEnd: '2026-10-02T01:00:00Z',
  digitSamples: [],
  ...patch,
});

describe('splitCandidates', () => {
  it('memisahkan dapur yang sampelnya cukup', () => {
    const split = splitCandidates(
      [
        { sppgId: 'a', manualCount: 42, isDemo: false },
        { sppgId: 'b', manualCount: 12, isDemo: false },
      ],
      30,
    );
    expect(split.eligible.map((entry) => entry.sppgId)).toEqual(['a']);
    expect(split.insufficient).toEqual([{ sppgId: 'b', manualCount: 12 }]);
  });

  it('memperlakukan tepat pada batas sebagai memenuhi syarat', () => {
    const split = splitCandidates(
      [{ sppgId: 'a', manualCount: 30, isDemo: false }],
      30,
    );
    expect(split.eligible).toHaveLength(1);
    expect(split.insufficient).toHaveLength(0);
  });

  it('mengembalikan daftar kosong tanpa kandidat', () => {
    const split = splitCandidates([], 30);
    expect(split.eligible).toHaveLength(0);
    expect(split.insufficient).toHaveLength(0);
  });
});

describe('buildDigitRequest', () => {
  it('mengurutkan sampel naik menurut waktu', () => {
    const request = buildDigitRequest({
      sppgId: 'sppg-1',
      dateFrom: '2026-07-20',
      dateTo: '2026-10-18',
      threshold: 0.3,
      sampleSize: 30,
      sampleMin: 30,
      samples: [
        sample('c', '2026-10-03T01:00:00Z'),
        sample('a', '2026-10-01T01:00:00Z'),
        sample('b', '2026-10-02T01:00:00Z'),
      ],
    });
    expect(request.samples.map((entry) => entry.batchId)).toEqual(['a', 'b', 'c']);
    expect(request.mode).toBe('digit');
    expect(request.options?.threshold).toBe(0.3);
  });

  it('tidak mengirim ambang bila parameter belum terkalibrasi', () => {
    const request = buildDigitRequest({
      sppgId: 'sppg-1',
      dateFrom: '2026-07-20',
      dateTo: '2026-10-18',
      threshold: null,
      sampleSize: 30,
      sampleMin: 30,
      samples: [],
    });
    expect(request.options?.threshold).toBeUndefined();
    expect(request.options?.sampleSize).toBe(30);
  });

  it('tidak mengubah daftar sampel masukan', () => {
    const input = [
      sample('a', '2026-10-02T01:00:00Z'),
      sample('b', '2026-10-01T01:00:00Z'),
    ];
    buildDigitRequest({
      sppgId: 'sppg-1',
      dateFrom: '2026-07-20',
      dateTo: '2026-10-18',
      threshold: null,
      sampleSize: 30,
      sampleMin: 30,
      samples: input,
    });
    expect(input.map((entry) => entry.batchId)).toEqual(['a', 'b']);
  });
});

describe('keputusan tindak lanjut', () => {
  it('menandai hanya saat proporsi tinggi', () => {
    expect(shouldFlag(analysis())).toBe(true);
    expect(shouldFlag(analysis({ flagged: false, reason: 'DALAM_AMBANG' }))).toBe(
      false,
    );
  });

  it('menutup otomatis hanya saat sampel cukup dan ada ambang', () => {
    expect(
      shouldAutoClose(analysis({ flagged: false, reason: 'DALAM_AMBANG' })),
    ).toBe(true);
    expect(
      shouldAutoClose(
        analysis({
          flagged: false,
          reason: 'AMBANG_BELUM_TERKALIBRASI',
          threshold: null,
        }),
      ),
    ).toBe(false);
    expect(
      shouldAutoClose(
        analysis({ flagged: false, reason: 'SAMPEL_KURANG', sampleCount: 5 }),
      ),
    ).toBe(false);
  });

  it('catatan penutupan memuat angka yang bisa dilacak', () => {
    const note = autoCloseNote(
      analysis({ flagged: false, reason: 'DALAM_AMBANG', proportion: 0.1833 }),
    );
    expect(note).toContain('18.33%');
    expect(note).toContain('30 sampel');
    expect(note).toContain('30.00%');
  });

  it('rincian anomali memuat jendela dan sampel', () => {
    const detail = digitAnomalyDetail(
      analysis({ digitSamples: [{ batchId: 'b1', weightKg: 12.5 }] }),
    );
    expect(detail.sampleCount).toBe(30);
    expect(detail.proportion).toBe(0.4);
    expect(detail.excludedDeviceCount).toBe(0);
    expect(detail.window).toEqual({
      dateFrom: '2026-07-20',
      dateTo: '2026-10-18',
      sampleFrom: '2026-10-01T01:00:00Z',
      sampleTo: '2026-10-02T01:00:00Z',
    });
    expect(detail.digitSamples).toEqual([{ batchId: 'b1', weightKg: 12.5 }]);
  });
});