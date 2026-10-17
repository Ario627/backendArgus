import type { DistributionPointKind } from '../common/constant/domain.constant.js';
import type { DistributionPoint } from '../database/entities/distribution-point.entity.js';
import type { Sppg } from '../database/entities/sppg.entity.js';

export interface SppgDto {
  readonly id: string;
  readonly publicSlug: string;
  readonly nama: string;
  readonly alamat: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly porsiPerHari: number;
  readonly mitra: string | null;
  readonly kapasitasOlahKg: number | null;
  readonly aktif: boolean;
  readonly isDemo: boolean;
  readonly createdAt: string;
}

export interface PointDto {
  readonly id: string;
  readonly sppgId: string;
  readonly nama: string;
  readonly jenis: DistributionPointKind;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly aktif: boolean;
  readonly createdAt: string;
}

export interface SppgDetailDto extends SppgDto {
  readonly points: readonly PointDto[];
}

export const toSppgDto = (sppg: Sppg): SppgDto => ({
  id: sppg.id,
  publicSlug: sppg.publicSlug,
  nama: sppg.nama,
  alamat: sppg.alamat,
  lat: sppg.lat,
  lng: sppg.lng,
  porsiPerHari: sppg.porsiPerHari,
  mitra: sppg.mitra,
  kapasitasOlahKg: sppg.kapasitasOlahKg,
  aktif: sppg.aktif,
  isDemo: sppg.isDemo,
  createdAt: sppg.createdAt.toISOString(),
});

export const toPointDto = (point: DistributionPoint): PointDto => ({
  id: point.id,
  sppgId: point.sppgId,
  nama: point.nama,
  jenis: point.jenis,
  lat: point.lat,
  lng: point.lng,
  aktif: point.aktif,
  createdAt: point.createdAt.toISOString(),
});
