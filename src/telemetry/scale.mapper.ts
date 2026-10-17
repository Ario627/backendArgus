import type { ScalePending } from '../database/entities/scale-pending.entity.js';
import {
  toLedgerEventDto,
  type LedgerEventDto,
} from '../ledger/ledger.mapper.js';
import type { AppendLedgerResult } from '../ledger/ledger.service.js';

export interface ScalePendingDto {
  readonly id: string;
  readonly deviceId: string;
  readonly sppgId: string;
  readonly beratKg: number;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly ageSeconds: number;
  readonly kedaluwarsa: boolean;
  readonly dipakaiBatchId: string | null;
  readonly ditautkanAt: string | null;
}

export interface ScaleLinkResultDto {
  readonly pending: ScalePendingDto;
  readonly event: LedgerEventDto;
  readonly duplicate: boolean;
}

const ageSecondsOf = (receivedAt: Date, nowMs: number): number =>
  Math.max(0, Math.floor((nowMs - receivedAt.getTime()) / 1000));

export const toScalePendingDto = (
  row: ScalePending,
  nowMs: number,
  maxAgeMs: number,
): ScalePendingDto => {
  const ageSeconds = ageSecondsOf(row.receivedAt, nowMs);
  return {
    id: row.id,
    deviceId: row.deviceId,
    sppgId: row.sppgId,
    beratKg: row.beratKg,
    occurredAt: row.occurredAt.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    ageSeconds,
    kedaluwarsa: ageSeconds * 1000 > maxAgeMs,
    dipakaiBatchId: row.dipakaiBatchId,
    ditautkanAt: row.ditautkanAt?.toISOString() ?? null,
  };
};

export const toScaleLinkResultDto = (
  row: ScalePending,
  appended: AppendLedgerResult,
  nowMs: number,
  maxAgeMs: number,
): ScaleLinkResultDto => ({
  pending: toScalePendingDto(row, nowMs, maxAgeMs),
  event: toLedgerEventDto(appended.event),
  duplicate: appended.duplicate,
});