import type { LedgerEventType } from '../common/constant/domain.constant.js';
import { fromHundredths, toHundredths } from '../common/utils/decimal.util.js';

export type LedgerEventData = Readonly<Record<string, unknown>>;

export interface LedgerPayloadInput {
  readonly batchId: string;
  readonly tipe: LedgerEventType;
  readonly beratKg: number | null;
  readonly aktor: string | null;
  readonly deviceId: string | null;
  readonly fotoHash: string | null;
  readonly waktuKejadian: Date;
  readonly catatan: string | null;
  readonly data: LedgerEventData | null;
  readonly clientEventId: string | null;
}

const normalizeWeight = (beratKg: number | null): number | null =>
  beratKg === null ? null : fromHundredths(toHundredths(beratKg));

export const buildLedgerPayload = (input: LedgerPayloadInput): LedgerEventData =>
  Object.freeze({
    batchId: input.batchId,
    tipe: input.tipe,
    beratKg: normalizeWeight(input.beratKg),
    aktor: input.aktor,
    deviceId: input.deviceId,
    fotoHash: input.fotoHash,
    waktuKejadian: input.waktuKejadian.toISOString(),
    catatan: input.catatan,
    data: input.data === null ? null : { ...input.data },
    clientEventId: input.clientEventId,
  });