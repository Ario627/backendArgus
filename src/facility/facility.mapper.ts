import type { FacilityKind, FacilityLevel } from '../common/constant/domain.constant.js';
import type { AcceptanceProfile } from '../database/entities/acceptance-profile.entity.js';
import type { Facility } from '../database/entities/facility.entity.js';

export interface FacilityDto {
  readonly id: string;
  readonly nama: string;
  readonly tingkat: FacilityLevel;
  readonly jenis: FacilityKind;
  readonly lat: number;
  readonly lng: number;
  readonly kapasitasKgHari: number | null;
  readonly jamOperasi: string | null;
  readonly mitra: boolean;
  readonly aktif: boolean;
  readonly isDemo: boolean;
  readonly createdAt: string;
}

export interface ProfileDto {
  readonly id: string;
  readonly facilityId: string;
  readonly version: number;
  readonly rules: Record<string, unknown>;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
}

export const toFacilityDto = (facility: Facility): FacilityDto => ({
  id: facility.id,
  nama: facility.nama,
  tingkat: facility.tingkat,
  jenis: facility.jenis,
  lat: facility.lat,
  lng: facility.lng,
  kapasitasKgHari: facility.kapasitasKgHari,
  jamOperasi: facility.jamOperasi,
  mitra: facility.mitra,
  aktif: facility.aktif,
  isDemo: facility.isDemo,
  createdAt: facility.createdAt.toISOString(),
});

export const toProfileDto = (profile: AcceptanceProfile): ProfileDto => ({
  id: profile.id,
  facilityId: profile.fasilitasId,
  version: profile.versi,
  rules: profile.aturan,
  effectiveFrom: profile.berlakuDari.toISOString(),
  effectiveUntil: profile.berlakuSampai === null ? null : profile.berlakuSampai.toISOString(),
  createdBy: profile.dibuatOleh,
  createdAt: profile.createdAt.toISOString(),
});