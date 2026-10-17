import { describe, expect, it } from '@jest/globals';
import {
  buildScaleSignatureBasis,
  computeScaleSignature,
  deriveScaleEventUuid,
  parseScaleTopic,
  verifyScaleSignature,
} from './scale-payload.util.js';

const DEVICE = '0192f0b1-0000-7000-8000-00000000b101';
const SECRET = 'argus-e2e-secret-0123456789abcdef0123456789abcdef';
const OCCURRED_AT = '2026-10-16T04:05:10Z';
const FROZEN_SIGNATURE =
  '3df6ff2215f46ecf55a43c79911b81a853d0fc2ea214885723278bfa60514715';
const FROZEN_EVENT_UUID = 'e6ce6dbe-9844-8137-85b8-71f4ec8da5bd';

describe('parseScaleTopic', () => {
  it('mengambil deviceId dari topik yang sah', () => {
    expect(parseScaleTopic(`scale/${DEVICE}/weight`)).toBe(DEVICE);
  });

  it('menolak pola salah, uuid huruf besar, dan prefix lain', () => {
    expect(parseScaleTopic(`scale/${DEVICE.toUpperCase()}/weight`)).toBeNull();
    expect(parseScaleTopic('scale/abc/weight')).toBeNull();
    expect(parseScaleTopic(`fleet/${DEVICE}/weight`)).toBeNull();
    expect(parseScaleTopic(`scale/${DEVICE}/telemetry`)).toBeNull();
  });
});

describe('buildScaleSignatureBasis', () => {
  it('menyusun basis pipa dengan berat dua desimal kanonik', () => {
    expect(buildScaleSignatureBasis(DEVICE, 12.4, OCCURRED_AT)).toBe(
      `${DEVICE}|12.40|${OCCURRED_AT}`,
    );
    expect(buildScaleSignatureBasis(DEVICE, 7, OCCURRED_AT)).toContain('|7.00|');
  });
});

describe('computeScaleSignature', () => {
  it('cocok dengan vektor beku HMAC-SHA256', () => {
    const basis = buildScaleSignatureBasis(DEVICE, 12.4, OCCURRED_AT);
    expect(computeScaleSignature(SECRET, basis)).toBe(FROZEN_SIGNATURE);
  });
});

describe('verifyScaleSignature', () => {
  it('menerima tanda tangan benar dan menolak yang salah/terpotong', () => {
    const basis = buildScaleSignatureBasis(DEVICE, 12.4, OCCURRED_AT);
    expect(verifyScaleSignature(SECRET, basis, FROZEN_SIGNATURE)).toBe(true);
    expect(verifyScaleSignature(SECRET, basis, `${'0'.repeat(63)}1`)).toBe(
      false,
    );
    expect(verifyScaleSignature(SECRET, basis, 'abc')).toBe(false);
    expect(verifyScaleSignature('secret-lain', basis, FROZEN_SIGNATURE)).toBe(
      false,
    );
  });

  it('menolak basis yang diubah (berat atau waktu digeser)', () => {
    expect(
      verifyScaleSignature(
        SECRET,
        buildScaleSignatureBasis(DEVICE, 12.41, OCCURRED_AT),
        FROZEN_SIGNATURE,
      ),
    ).toBe(false);
    expect(
      verifyScaleSignature(
        SECRET,
        buildScaleSignatureBasis(DEVICE, 12.4, '2026-10-16T04:05:11Z'),
        FROZEN_SIGNATURE,
      ),
    ).toBe(false);
  });
});

describe('deriveScaleEventUuid', () => {
  it('deterministik dan berformat uuid dengan version 8', () => {
    const first = deriveScaleEventUuid(DEVICE, 12.4, OCCURRED_AT);
    expect(first).toBe(FROZEN_EVENT_UUID);
    expect(first).toBe(deriveScaleEventUuid(DEVICE, 12.4, OCCURRED_AT));
    expect(first[14]).toBe('8');
    expect('89ab').toContain(first[19]);
  });

  it('berbeda saat device, berat, atau waktu berbeda', () => {
    const base = deriveScaleEventUuid(DEVICE, 12.4, OCCURRED_AT);
    expect(deriveScaleEventUuid(DEVICE, 12.41, OCCURRED_AT)).not.toBe(base);
    expect(deriveScaleEventUuid(DEVICE, 12.4, '2026-10-16T04:05:11Z')).not.toBe(
      base,
    );
  });
});