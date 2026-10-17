import type { Batch } from '../database/entities/batch.entity.js';
import type { DispositionTier, WasteFlow } from '../common/constant/domain.constant.js';
import { chosenFacilityIdOf } from '../batch/batch-access.util.js';

export interface DispositionQueueItem {
  readonly batchId: string;
  readonly sppgId: string;
  readonly aliran: WasteFlow;
  readonly weightKg: number;
  readonly ageHours: number;
  readonly status: string;
  readonly gateStatus: string | null;
  readonly tier: DispositionTier | null;
  readonly chosenFacilityId: string | null;
  readonly decisionReason: string | null;
  readonly decidedAt: string | null;
}

export interface BatchDispositionDetail {
  readonly batchId: string;
  readonly sppgId: string;
  readonly tier: DispositionTier | null;
  readonly decidedAt: string | null;
  readonly detail: Record<string, unknown> | null;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

const readString = (source: Record<string, unknown> | null, key: string): string | null => {
  if (source === null) return null;
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

export const toQueueItem = (batch: Batch, now: Date): DispositionQueueItem => {
  const ageMs = Math.max(0, now.getTime() - batch.dikeluarkanAt.getTime());
  return {
    batchId: batch.id,
    sppgId: batch.sppgId,
    aliran: batch.aliran,
    weightKg: batch.beratKg,
    ageHours: round1(ageMs / 3600000),
    status: batch.status,
    gateStatus: batch.gateStatus,
    tier: (batch.tingkatPutusan as DispositionTier | null) ?? null,
    chosenFacilityId: chosenFacilityIdOf(batch.alasanPutusan),
    decisionReason: readString(batch.alasanPutusan, 'reason'),
    decidedAt: readString(batch.alasanPutusan, 'decidedAt'),
  };
};

export const toBatchDispositionDetail = (batch: Batch): BatchDispositionDetail => ({
  batchId: batch.id,
  sppgId: batch.sppgId,
  tier: (batch.tingkatPutusan as DispositionTier | null) ?? null,
  decidedAt: readString(batch.alasanPutusan, 'decidedAt'),
  detail: batch.alasanPutusan,
});