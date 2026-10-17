import { createHash, createHmac } from 'node:crypto';
import { safeHashEquals } from '../common/utils/hash.util.js';

export const SCALE_TOPIC_PATTERN =
  /^scale\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/weight$/;

export const SCALE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export const SCALE_SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

const EVENT_ID_PREFIX = 'argus-scale';

const buildBasis = (
  deviceId: string,
  weightKg: number,
  occurredAt: string,
): string => `${deviceId}|${weightKg.toFixed(2)}|${occurredAt}`;

export const parseScaleTopic = (topic: string): string | null =>
  SCALE_TOPIC_PATTERN.exec(topic)?.[1] ?? null;

export const buildScaleSignatureBasis = (
  deviceId: string,
  weightKg: number,
  occurredAt: string,
): string => buildBasis(deviceId, weightKg, occurredAt);

export const computeScaleSignature = (secret: string, basis: string): string =>
  createHmac('sha256', secret).update(basis, 'utf8').digest('hex');

export const verifyScaleSignature = (
  secret: string,
  basis: string,
  signature: string,
): boolean => safeHashEquals(computeScaleSignature(secret, basis), signature);

export const deriveScaleEventUuid = (
  deviceId: string,
  weightKg: number,
  occurredAt: string,
): string => {
  const bytes = createHash('sha256')
    .update(
      `${EVENT_ID_PREFIX}|${buildBasis(deviceId, weightKg, occurredAt)}`,
      'utf8',
    )
    .digest('hex')
    .slice(0, 32)
    .split('');
  bytes[12] = '8';
  bytes[16] = '8';
  const hex = bytes.join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
};