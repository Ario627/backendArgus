import type { MenuComponent } from '../common/constant/domain.constant.js';
import type { LeftoverObservation } from '../database/entities/leftover-observation.entity.js';
import type { MenuItem } from '../database/entities/menu-item.entity.js';
import type { MenuServing } from '../database/entities/menu-serving.entity.js';

export interface MenuItemDto {
  readonly id: string;
  readonly nama: string;
  readonly komponen: MenuComponent;
  readonly biayaRp: number | null;
  readonly aktif: boolean;
}

export interface MenuServingDto {
  readonly id: string;
  readonly tanggal: string;
  readonly sppgId: string;
  readonly menuItemId: string;
  readonly titikId: string | null;
  readonly duplicate: boolean;
}

export interface ObservationDto {
  readonly id: string;
  readonly tanggal: string;
  readonly sppgId: string;
  readonly titikId: string;
  readonly menuItemId: string;
  readonly tingkatSisa: number;
  readonly jumlahPorsiDinilai: number;
  readonly clientEventId: string | null;
  readonly isDemo: boolean;
  readonly createdAt: string;
}

export const toMenuItemDto = (item: MenuItem): MenuItemDto => ({
  id: item.id,
  nama: item.nama,
  komponen: item.komponen,
  biayaRp: item.biayaRp,
  aktif: item.aktif,
});

export const toMenuServingDto = (serving: MenuServing, duplicate: boolean): MenuServingDto => ({
  id: serving.id,
  tanggal: serving.tanggal,
  sppgId: serving.sppgId,
  menuItemId: serving.menuItemId,
  titikId: serving.titikId,
  duplicate,
});

export const toObservationDto = (observation: LeftoverObservation): ObservationDto => ({
  id: observation.id,
  tanggal: observation.tanggal,
  sppgId: observation.sppgId,
  titikId: observation.titikId,
  menuItemId: observation.menuItemId,
  tingkatSisa: observation.tingkatSisa,
  jumlahPorsiDinilai: observation.jumlahPorsiDinilai,
  clientEventId: observation.clientEventId,
  isDemo: observation.isDemo,
  createdAt: observation.createdAt.toISOString(),
});