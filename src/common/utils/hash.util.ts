import { createHash, timingSafeEqual } from 'node:crypto';

export const GENESIS_PREV_HASH = 'GENESIS';

export type ChainRowId = number | string | bigint;

export interface LedgerChainRow {
  readonly id: ChainRowId;
  readonly prevHash: string | null;
  readonly hash: string;
  readonly payload: unknown;
}

export interface ChainBreach {
  readonly index: number;
  readonly id: ChainRowId;
  readonly reason: 'HASH_MISMATCH' | 'PREV_LINK_MISMATCH';
  readonly expectedHash: string;
  readonly actualHash: string;
  readonly expectedPrevHash: string | null;
  readonly actualPrevHash: string | null;
}

export interface ChainVerification {
  readonly ok: boolean;
  readonly checked: number;
  readonly breach: ChainBreach | null;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};

const readOwnDataProperty = (target: Record<string, unknown>, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor || !('value' in descriptor)) {
    throw new TypeError(`CANONICAL_JSON_ACCESSOR_PROPERTY:${key}`);
  }
  return descriptor.value;
};

const canonicalizeArray = (value: readonly unknown[]): string => {
  const parts: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      throw new TypeError(`CANONICAL_JSON_ARRAY_HOLE:${index}`);
    }
    parts.push(canonicalJson(value[index]));
  }
  return `[${parts.join(',')}]`;
};

const canonicalizeObject = (value: Record<string, unknown>): string => {
  const keys = Object.keys(value).sort();
  const parts = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJson(readOwnDataProperty(value, key))}`,
  );
  return `{${parts.join(',')}}`;
};

export const canonicalJson = (value: unknown): string => {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'string') return JSON.stringify(value);
  if (type === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('CANONICAL_JSON_NON_FINITE_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return canonicalizeArray(value);
  if (isPlainObject(value)) return canonicalizeObject(value);
  throw new TypeError(`CANONICAL_JSON_UNSUPPORTED_TYPE:${type}`);
};

export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

export const hitungHash = (prevHash: string | null, payload: unknown): string =>
  sha256Hex(`${prevHash ?? GENESIS_PREV_HASH}|${canonicalJson(payload)}`);

export const safeHashEquals = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
};

export const verifyChain = (rows: readonly LedgerChainRow[]): ChainVerification => {
  let expectedPrevHash: string | null = null;
  let index = 0;
  for (const row of rows) {
    const recomputedHash = hitungHash(expectedPrevHash, row.payload);
    if (!safeHashEquals(recomputedHash, row.hash)) {
      return {
        ok: false,
        checked: index,
        breach: {
          index,
          id: row.id,
          reason: 'HASH_MISMATCH',
          expectedHash: recomputedHash,
          actualHash: row.hash,
          expectedPrevHash,
          actualPrevHash: row.prevHash,
        },
      };
    }
    const prevLinkOk =
      expectedPrevHash === null
        ? row.prevHash === null
        : row.prevHash !== null && safeHashEquals(expectedPrevHash, row.prevHash);
    if (!prevLinkOk) {
      return {
        ok: false,
        checked: index,
        breach: {
          index,
          id: row.id,
          reason: 'PREV_LINK_MISMATCH',
          expectedHash: recomputedHash,
          actualHash: row.hash,
          expectedPrevHash,
          actualPrevHash: row.prevHash,
        },
      };
    }
    expectedPrevHash = row.hash;
    index += 1;
  }
  return { ok: true, checked: index, breach: null };
};