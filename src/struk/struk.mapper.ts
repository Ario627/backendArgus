import type {
  BatchStatus,
  FractionCode,
  GateStatus,
  LedgerEventType,
  WasteFlow,
} from '../common/constant/domain.constant.js';

const WIB_OFFSET_MS = 7 * 3600000;

export interface StrukFractionDto {
  readonly kode: FractionCode;
  readonly persen: number;
}

export interface StrukTraceDto {
  readonly tipe: LedgerEventType;
  readonly waktu: string;
}

export interface PublicStrukDto {
  readonly batchId: string;
  readonly sppgNama: string;
  readonly sppgAlamat: string | null;
  readonly aliran: WasteFlow;
  readonly tanggalWib: string;
  readonly jamWib: string;
  readonly beratKg: number;
  readonly fraksi: readonly StrukFractionDto[];
  readonly gateStatus: GateStatus | null;
  readonly tingkatPutusan: string | null;
  readonly status: BatchStatus;
  readonly rantaiUtuh: boolean;
  readonly jumlahEvent: number;
  readonly jejak: readonly StrukTraceDto[];
  readonly isDemo: boolean;
  readonly berlakuSampai: string;
}

export interface StrukLinkDto {
  readonly url: string;
  readonly berlakuSampai: string;
}

export const toWibDate = (instant: Date): string =>
  new Date(instant.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);

export const toWibTime = (instant: Date): string =>
  new Date(instant.getTime() + WIB_OFFSET_MS).toISOString().slice(11, 16);