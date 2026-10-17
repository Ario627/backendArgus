import { describe, expect, it } from '@jest/globals';
import {
  evaluateTrackerPolicy,
  parseTrackerTopic,
  type TrackerPolicyInput,
} from './telemetry-policy.util.js';

const FLEET = '0192f0a0-1111-7777-8888-999999999999';

const input = (
  overrides: Partial<TrackerPolicyInput> = {},
): TrackerPolicyInput => ({
  fleetIdFromTopic: FLEET,
  payloadFleetId: FLEET,
  deviceTimestampMs: 1_000_000,
  nowMs: 1_000_000,
  futureSkewSeconds: 300,
  maxAgeSeconds: 604800,
  ...overrides,
});

describe('parseTrackerTopic', () => {
  it('mengambil fleetId dari topik yang sah', () => {
    expect(parseTrackerTopic(`fleet/${FLEET}/telemetry`)).toBe(FLEET);
  });

  it('menolak topik cacat atau pola salah', () => {
    expect(parseTrackerTopic(`fleet/${FLEET.toUpperCase()}/telemetry`)).toBeNull();
    expect(parseTrackerTopic('fleet/abc/telemetry')).toBeNull();
    expect(parseTrackerTopic(`fleet/${FLEET}/weight`)).toBeNull();
    expect(parseTrackerTopic(`scale/${FLEET}/telemetry`)).toBeNull();
    expect(parseTrackerTopic(`fleet/${FLEET}/telemetry/extra`)).toBeNull();
  });
});

describe('evaluateTrackerPolicy', () => {
  it('meloloskan payload tepat waktu dan cocok topik', () => {
    expect(evaluateTrackerPolicy(input())).toEqual({ ok: true });
  });

  it('menolak topik tidak valid dan fleetId tidak cocok', () => {
    expect(
      evaluateTrackerPolicy(input({ fleetIdFromTopic: null })),
    ).toEqual({ ok: false, reason: 'TOPIC_INVALID' });
    expect(
      evaluateTrackerPolicy(input({ payloadFleetId: FLEET.replace('0', '1') })),
    ).toEqual({ ok: false, reason: 'FLEET_MISMATCH' });
  });

  it('menolak waktu terlalu jauh di depan, masih menerima dalam toleransi', () => {
    expect(
      evaluateTrackerPolicy(input({ deviceTimestampMs: 1_301_000 })),
    ).toEqual({ ok: false, reason: 'TIME_FUTURE' });
    expect(
      evaluateTrackerPolicy(input({ deviceTimestampMs: 1_299_000 })),
    ).toEqual({ ok: true });
  });

  it('menolak waktu terlalu tua, masih menerima tepat di batas umur', () => {
    expect(
      evaluateTrackerPolicy(
        input({ nowMs: 1_000_000_000, deviceTimestampMs: 0 }),
      ),
    ).toEqual({ ok: false, reason: 'TIME_TOO_OLD' });
    expect(
      evaluateTrackerPolicy(
        input({ nowMs: 604_800_000, deviceTimestampMs: 0 }),
      ),
    ).toEqual({ ok: true });
  });
});