export type TelemetryDropReason =
  | 'TOPIC_INVALID'
  | 'FLEET_MISMATCH'
  | 'TIME_FUTURE'
  | 'TIME_TOO_OLD'
  | 'RATE_LIMITED';

export const TRACKER_TOPIC_PATTERN =
  /^fleet\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/telemetry$/;

export interface TrackerPolicyInput {
  readonly fleetIdFromTopic: string | null;
  readonly payloadFleetId: string;
  readonly deviceTimestampMs: number;
  readonly nowMs: number;
  readonly futureSkewSeconds: number;
  readonly maxAgeSeconds: number;
}

export type TrackerPolicyVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: TelemetryDropReason };

export const parseTrackerTopic = (topic: string): string | null =>
  TRACKER_TOPIC_PATTERN.exec(topic)?.[1] ?? null;

export const evaluateTrackerPolicy = (
  input: TrackerPolicyInput,
): TrackerPolicyVerdict => {
  if (input.fleetIdFromTopic === null) {
    return { ok: false, reason: 'TOPIC_INVALID' };
  }
  if (input.fleetIdFromTopic !== input.payloadFleetId) {
    return { ok: false, reason: 'FLEET_MISMATCH' };
  }
  if (input.deviceTimestampMs > input.nowMs + input.futureSkewSeconds * 1000) {
    return { ok: false, reason: 'TIME_FUTURE' };
  }
  if (input.deviceTimestampMs < input.nowMs - input.maxAgeSeconds * 1000) {
    return { ok: false, reason: 'TIME_TOO_OLD' };
  }
  return { ok: true };
};