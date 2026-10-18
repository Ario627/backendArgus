import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { AnomalyWriterService } from '../anomaly/anomaly-writer.service.js';
import type { ParameterService } from '../parameter/parameter.service.js';
import type { AppConfiguration } from '../config/configuration.js';
import type { AnalyticsClient } from './analytics.client.js';
import type { AnalyticsRequest, DigitAnalysis } from './analytics.contract.js';
import type { DigitSampleService } from './digit-sample.service.js';
import { DigitScanService } from './digit-scan.service.js';

const ACTOR_ID = '99999999-9999-7999-8999-999999999999';
const WINDOW = {
  since: new Date('2026-07-19T17:00:00.000Z'),
  dateFrom: '2026-07-20',
  dateTo: '2026-10-18',
};

const candidateMock = jest.fn<DigitSampleService['candidates']>();
const sampleMock = jest.fn<DigitSampleService['samples']>();
const analyzeMock = jest.fn<AnalyticsClient['analyze']>();
const parameterMock = jest.fn<ParameterService['getValue']>();
const persistMock = jest.fn<AnomalyWriterService['persistSppgScope']>();
const closeMock = jest.fn<AnomalyWriterService['closeSppgScope']>();

const makeConfig = (
  patch: Partial<AppConfiguration['analytics']> = {},
): AppConfiguration =>
  ({
    demoMode: false,
    analytics: {
      url: 'http://localhost:8200',
      token: '',
      timeoutMs: 10000,
      lookbackDays: 90,
      maxSppgPerScan: 20,
      sampleSize: 30,
      sampleMin: 30,
      ...patch,
    },
  }) as unknown as AppConfiguration;

const makeService = (config: AppConfiguration): DigitScanService =>
  new DigitScanService(
    { getOrThrow: () => config } as unknown as ConfigService,
    {
      candidates: candidateMock,
      samples: sampleMock,
    } as unknown as DigitSampleService,
    { analyze: analyzeMock } as unknown as AnalyticsClient,
    { getValue: parameterMock } as unknown as ParameterService,
    {
      persistSppgScope: persistMock,
      closeSppgScope: closeMock,
    } as unknown as AnomalyWriterService,
  );

const makeAnalysis = (patch: Partial<DigitAnalysis> = {}): DigitAnalysis =>
  ({
    mode: 'digit',
    rule: 'LAST_CENTIGRAM_0_OR_5',
    sppgId: 'sppg-1',
    dateFrom: WINDOW.dateFrom,
    dateTo: WINDOW.dateTo,
    sampleCount: 30,
    digitCount: 12,
    proportion: 0.4,
    threshold: 0.3,
    sampleSize: 30,
    sampleMin: 30,
    flagged: true,
    reason: 'PROPORSI_DIGIT_TINGGI',
    excludedDeviceCount: 0,
    windowStart: '2026-10-01T01:00:00+00:00',
    windowEnd: '2026-10-02T01:00:00+00:00',
    digitSamples: [],
    ...patch,
  }) as DigitAnalysis;

const normal = (patch: Partial<DigitAnalysis> = {}): DigitAnalysis =>
  makeAnalysis({
    flagged: false,
    reason: 'DALAM_AMBANG',
    digitCount: 4,
    proportion: 0.1333,
    ...patch,
  });

const candidatePage = (manualCount = 40) => ({
  candidates: [{ sppgId: 'sppg-1', manualCount, isDemo: false }],
  total: 1,
});

const sampleRow = (batchId: string) => ({
  batchId,
  weightKg: 12.5,
  occurredAt: '2026-10-01T01:00:00.000Z',
  origin: 'manual' as const,
});

beforeEach(() => {
  jest.clearAllMocks();
  candidateMock.mockResolvedValue(candidatePage());
  sampleMock.mockResolvedValue([sampleRow('b1')]);
  parameterMock.mockResolvedValue({ nilai: 0.3, sumber: 'kalibrasi_pilot' });
  analyzeMock.mockResolvedValue({ analysis: makeAnalysis() });
  persistMock.mockResolvedValue(true);
  closeMock.mockResolvedValue(0);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('DigitScanService', () => {
  it('melempar ANALYTICS_NO_SAMPLE bila tidak ada dapur dengan timbangan manual', async () => {
    candidateMock.mockResolvedValue({ candidates: [], total: 0 });
    const service = makeService(makeConfig());
    await expect(
      service.scan({}, ACTOR_ID, makeConfig()),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'ANALYTICS_NO_SAMPLE' },
    });
  });

  it('memisahkan dapur bersampel kurang tanpa memanggil analitik', async () => {
    candidateMock.mockResolvedValue({
      candidates: [{ sppgId: 'sppg-kurang', manualCount: 12, isDemo: false }],
      total: 1,
    });
    const service = makeService(makeConfig());
    const result = await service.scan({}, ACTOR_ID, makeConfig());
    expect(result.scanned).toBe(0);
    expect(result.insufficient).toEqual([
      { sppgId: 'sppg-kurang', manualCount: 12 },
    ]);
    expect(analyzeMock).not.toHaveBeenCalled();
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('menyimpan anomali saat proporsi digit melewati ambang', async () => {
    const service = makeService(makeConfig());
    const result = await service.scan({}, ACTOR_ID, makeConfig());
    expect(persistMock).toHaveBeenCalledTimes(1);
    const [sppgId, isDemo, jenis, detail] = persistMock.mock.calls[0] ?? [];
    expect(sppgId).toBe('sppg-1');
    expect(isDemo).toBe(false);
    expect(jenis).toBe('DIGIT_TIDAK_WAJAR');
    expect(detail).toMatchObject({
      sampleCount: 30,
      digitCount: 12,
      proportion: 0.4,
    });
    expect(closeMock).not.toHaveBeenCalled();
    expect(result.entries[0]).toMatchObject({
      flagged: true,
      persisted: true,
      closed: 0,
      reason: 'PROPORSI_DIGIT_TINGGI',
    });
    expect(result.status).toBe('OK');
  });

  it('menutup anomali lama saat pemindaian ulang kembali normal', async () => {
    analyzeMock.mockResolvedValue({ analysis: normal() });
    closeMock.mockResolvedValue(2);
    const service = makeService(makeConfig());
    const result = await service.scan({}, ACTOR_ID, makeConfig());
    expect(persistMock).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalledTimes(1);
    const [sppgId, jenis, actorId, note] = closeMock.mock.calls[0] ?? [];
    expect(sppgId).toBe('sppg-1');
    expect(jenis).toBe('DIGIT_TIDAK_WAJAR');
    expect(actorId).toBe(ACTOR_ID);
    expect(note).toContain('13.33%');
    expect(result.entries[0]).toMatchObject({ closed: 2, persisted: false });
  });

  it('tidak menutup apa pun saat ambang belum terkalibrasi', async () => {
    parameterMock.mockResolvedValue({ nilai: null, sumber: 'belum_ada' });
    analyzeMock.mockResolvedValue({
      analysis: normal({
        threshold: null,
        reason: 'AMBANG_BELUM_TERKALIBRASI',
      }),
    });
    const service = makeService(makeConfig());
    const result = await service.scan({}, ACTOR_ID, makeConfig());
    expect(closeMock).not.toHaveBeenCalled();
    expect(persistMock).not.toHaveBeenCalled();
    expect(result.threshold).toBeNull();
    expect(result.entries[0]).toMatchObject({
      reason: 'AMBANG_BELUM_TERKALIBRASI',
      closed: 0,
    });
  });

  it('mengabaikan ambang parameter yang di luar rentang nol sampai satu', async () => {
    parameterMock.mockResolvedValue({ nilai: 5, sumber: 'manual_admin' });
    const service = makeService(makeConfig());
    const result = await service.scan({}, ACTOR_ID, makeConfig());
    expect(result.threshold).toBeNull();
    const request = analyzeMock.mock.calls[0]?.[0];
    expect(request?.options?.threshold).toBeUndefined();
  });

  it('meneruskan ambang terkalibrasi ke layanan analitik', async () => {
    const service = makeService(makeConfig());
    await service.scan({}, ACTOR_ID, makeConfig());
    const request = analyzeMock.mock.calls[0]?.[0];
    expect(request?.options?.threshold).toBe(0.3);
    expect(request?.options?.sampleSize).toBe(30);
    expect(request?.options?.sampleMin).toBe(30);
    expect(request?.mode).toBe('digit');
    expect(request?.sppgId).toBe('sppg-1');
  });

  it('menyelaraskan jendela laporan dengan titik mulai query dalam WIB', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-18T01:05:00.000Z') });
    const service = makeService(makeConfig());
    const result = await service.scan({}, ACTOR_ID, makeConfig());
    expect(candidateMock).toHaveBeenCalledWith(WINDOW.since, null, 20, 0, false);
    expect(sampleMock).toHaveBeenCalledWith('sppg-1', WINDOW.since, 120);
    expect(result.window).toEqual({
      dateFrom: '2026-07-20',
      dateTo: '2026-10-18',
      lookbackDays: 90,
    });
    const request = analyzeMock.mock.calls[0]?.[0];
    expect(request?.dateFrom).toBe('2026-07-20');
    expect(request?.dateTo).toBe('2026-10-18');
  });

  it('menghormati lookback dan sasaran dapur dari permintaan', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-18T01:05:00.000Z') });
    const service = makeService(makeConfig());
    const result = await service.scan(
      { sppgId: '11111111-1111-7111-8111-111111111111', lookbackDays: 30 },
      ACTOR_ID,
      makeConfig(),
    );
    expect(candidateMock).toHaveBeenCalledWith(
      new Date('2026-09-17T17:00:00.000Z'),
      '11111111-1111-7111-8111-111111111111',
      20,
      0,
      false,
    );
    expect(result.window).toEqual({
      dateFrom: '2026-09-18',
      dateTo: '2026-10-18',
      lookbackDays: 30,
    });
  });

  it('mencatat kegagalan per dapur dan tetap memakai status PARTIAL', async () => {
    candidateMock.mockResolvedValue({
      candidates: [
        { sppgId: 'sppg-1', manualCount: 40, isDemo: false },
        { sppgId: 'sppg-2', manualCount: 40, isDemo: false },
      ],
      total: 2,
    });
    analyzeMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ analysis: makeAnalysis({ sppgId: 'sppg-2' }) });
    const service = makeService(makeConfig());
    const result = await service.scan({}, ACTOR_ID, makeConfig());
    expect(result.status).toBe('PARTIAL');
    expect(result.failures).toEqual([
      { sppgId: 'sppg-1', reason: 'ANALYTICS_TIDAK_TERSEDIA' },
    ]);
    expect(result.entries).toHaveLength(1);
  });

  it('melempar ANALYTICS_UNAVAILABLE hanya bila seluruh dapur gagal', async () => {
    analyzeMock.mockResolvedValue(null);
    const service = makeService(makeConfig());
    await expect(
      service.scan({}, ACTOR_ID, makeConfig()),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'ANALYTICS_UNAVAILABLE' },
    });
  });

  it('meneruskan flag demo dan batas dapur dari konfigurasi', async () => {
    const config = makeConfig({
      maxSppgPerScan: 5,
      sampleSize: 10,
      sampleMin: 10,
    });
    candidateMock.mockResolvedValue({
      candidates: [{ sppgId: 'sppg-1', manualCount: 40, isDemo: true }],
      total: 1,
    });
    const service = makeService(config);
    await service.scan({}, ACTOR_ID, config);
    expect(candidateMock).toHaveBeenCalledWith(
      expect.any(Date),
      null,
      5,
      0,
      false,
    );
    expect(sampleMock).toHaveBeenCalledWith('sppg-1', expect.any(Date), 40);
    expect(persistMock.mock.calls[0]?.[1]).toBe(true);
  });
});

describe('kontrak permintaan analitik', () => {
  it('mengirim permintaan yang lolos bentuk kontrak', async () => {
    const service = makeService(makeConfig());
    await service.scan({}, ACTOR_ID, makeConfig());
    const request = analyzeMock.mock.calls[0]?.[0] as AnalyticsRequest;
    expect(Object.keys(request).sort()).toEqual([
      'dateFrom',
      'dateTo',
      'mode',
      'options',
      'samples',
      'sppgId',
    ]);
    expect(request.samples[0]).toEqual(sampleRow('b1'));
  });
});