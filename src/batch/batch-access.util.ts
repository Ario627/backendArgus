import type { AuthenticatedUser } from "../common/types.js";
import type { Batch } from "../database/entities/batch.entity.js";

export interface BatchAccessView {
  readonly sppgId: string;
  readonly alasanPutusan: Record<string, unknown> | null;
}

export const chosenFacilityIdOf = (
  alasanPutusan: Record<string, unknown> | null,
): string | null => {
  if (alasanPutusan === null) return null;
  const value = alasanPutusan['chosenFacilityId'];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

export const canReadBatch = (
  actor: AuthenticatedUser,
  batch: Batch | BatchAccessView,
): boolean => {
  if (actor.role === 'admin' || actor.role === 'dlh_auditor') return true;
  if (actor.role === 'sppg_staff') return actor.sppgId === batch.sppgId;
  if (actor.role === 'facility') {
    const chosen = chosenFacilityIdOf(batch.alasanPutusan);
    return chosen !== null && chosen === actor.facilityId;
  }
  return false;
};