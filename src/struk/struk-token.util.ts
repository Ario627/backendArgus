import { createHmac } from 'node:crypto';
import { safeHashEquals } from '../common/utils/hash.util.js';

const TOKEN_VERSION = 'v1';
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_EPOCH_SECONDS = 4102444800;

export type StrukTokenFailure = 'MALFORMED' | 'SIGNATURE' | 'EXPIRED';

export type StrukTokenVerification =
  | {
      readonly ok: true;
      readonly batchId: string;
      readonly expiresAt: Date;
    }
  | { readonly ok: false; readonly reason: StrukTokenFailure };

interface ParsedToken {
  readonly payload: string;
  readonly batchId: string;
  readonly expiresAtEpochSeconds: number;
  readonly signature: string;
}

const sign = (secret: string, payload: string): string =>
  createHmac('sha256', secret).update(payload, 'utf8').digest('base64url');

const parse = (token: string): ParsedToken | null => {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [version, batchId, epochText, signature] = parts;
  if (version !== TOKEN_VERSION) return null;
  if (batchId === undefined || !UUID_PATTERN.test(batchId)) return null;
  if (epochText === undefined || !/^\d{1,10}$/.test(epochText)) return null;
  if (signature === undefined || !SIGNATURE_PATTERN.test(signature))
    return null;
  const expiresAtEpochSeconds = Number.parseInt(epochText, 10);
  if (expiresAtEpochSeconds <= 0 || expiresAtEpochSeconds > MAX_EPOCH_SECONDS) {
    return null;
  }
  return {
    payload: `${version}.${batchId}.${epochText}`,
    batchId,
    expiresAtEpochSeconds,
    signature,
  };
};

export const signStrukToken = (input: {
  readonly secret: string;
  readonly batchId: string;
  readonly expiresAt: Date;
}): string => {
  if (!UUID_PATTERN.test(input.batchId)) {
    throw new TypeError('STRUK_BATCH_ID_INVALID');
  }
  const epoch = Math.floor(input.expiresAt.getTime() / 1000);
  if (epoch <= 0 || epoch > MAX_EPOCH_SECONDS) {
    throw new TypeError('STRUK_EXPIRY_INVALID');
  }
  const payload = `${TOKEN_VERSION}.${input.batchId}.${epoch}`;
  return `${payload}.${sign(input.secret, payload)}`;
};

export const verifyStrukToken = (input: {
  readonly secret: string;
  readonly token: string;
  readonly now: Date;
}): StrukTokenVerification => {
  const parsed = parse(input.token);
  if (parsed === null) {
    return Object.freeze({ ok: false, reason: 'MALFORMED' });
  }
  if (!safeHashEquals(sign(input.secret, parsed.payload), parsed.signature)) {
    return Object.freeze({ ok: false, reason: 'SIGNATURE' });
  }
  if (parsed.expiresAtEpochSeconds * 1000 <= input.now.getTime()) {
    return Object.freeze({ ok: false, reason: 'EXPIRED' });
  }
  return Object.freeze({
    ok: true,
    batchId: parsed.batchId,
    expiresAt: new Date(parsed.expiresAtEpochSeconds * 1000),
  });
};