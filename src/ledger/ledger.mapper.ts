import type { LedgerEventType } from '../common/constant/domain.constant.js';
import type { LedgerEvent } from '../database/entities/ledger-event.entity.js';

export interface LedgerEventDto {
  readonly id: number;
  readonly batchId: string;
  readonly type: LedgerEventType;
  readonly actorId: string | null;
  readonly deviceId: string | null;
  readonly weightKg: number | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly photoHash: string | null;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly payload: Record<string, unknown>;
  readonly prevHash: string | null;
  readonly hash: string;
  readonly clientEventId: string | null;
  readonly isDemo: boolean;
}

export const toLedgerEventDto = (event: LedgerEvent): LedgerEventDto => ({
  id: event.id,
  batchId: event.batchId,
  type: event.tipe,
  actorId: event.aktor,
  deviceId: event.deviceId,
  weightKg: event.beratKg,
  lat: event.lat,
  lng: event.lng,
  photoHash: event.fotoHash,
  occurredAt: event.waktuKejadian.toISOString(),
  receivedAt: event.ts.toISOString(),
  payload: event.payload,
  prevHash: event.prevHash,
  hash: event.hash,
  clientEventId: event.clientEventId,
  isDemo: event.isDemo,
});