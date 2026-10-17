import type {
  BatchStatus,
  DispositionTier,
  FractionCode,
  GateStatus,
  MoistureProxy,
  WasteFlow,
} from '../common/constant/domain.constant.js';
import type { BatchFraction } from '../database/entities/batch-fraction.entity.js';
import type { Batch } from '../database/entities/batch.entity.js';
import type { LedgerEventDto } from '../ledger/ledger.mapper.js';

export interface BatchDto {
  readonly id: string;
  readonly sppgId: string;
  readonly aliran: WasteFlow;
  readonly dikeluarkanAt: string;
  readonly weightKg: number;
  readonly moistureProxy: MoistureProxy | null;
  readonly visibleOil: boolean;
  readonly fractions: Readonly<Partial<Record<FractionCode, number>>>;
  readonly tier: DispositionTier | null;
  readonly dispositionReason: Record<string, unknown> | null;
  readonly gateStatus: GateStatus | null;
  readonly gateDetail: Record<string, unknown> | null;
  readonly status: BatchStatus;
  readonly photoHash: string | null;
  readonly clientEventId: string | null;
  readonly clockSkewMs: number | null;
  readonly isDemo: boolean;
  readonly createdAt: string;
}

export interface BatchDetailDto extends BatchDto {
  readonly ledger: readonly LedgerEventDto[];
}

export const toBatchDto = (
  batch: Batch,
  fractions: readonly BatchFraction[],
): BatchDto => {
  const composition: Partial<Record<FractionCode, number>> = {};
  for (const fraction of fractions) {
    composition[fraction.kode] = fraction.persen;
  }
  return {
    id: batch.id,
    sppgId: batch.sppgId,
    aliran: batch.aliran,
    dikeluarkanAt: batch.dikeluarkanAt.toISOString(),
    weightKg: batch.beratKg,
    moistureProxy: batch.kadarAirProksi,
    visibleOil: batch.adaMinyakTerlihat,
    fractions: composition,
    tier: (batch.tingkatPutusan as DispositionTier | null) ?? null,
    dispositionReason: batch.alasanPutusan,
    gateStatus: batch.gateStatus,
    gateDetail: batch.gateDetail,
    status: batch.status,
    photoHash: batch.fotoHash,
    clientEventId: batch.clientEventId,
    clockSkewMs: batch.clockSkewMs,
    isDemo: batch.isDemo,
    createdAt: batch.createdAt.toISOString(),
  };
};