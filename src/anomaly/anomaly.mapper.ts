import type {
  AnomalyKind,
  AnomalySeverity,
} from '../common/constant/domain.constant.js';

export interface AnomalyDto {
  readonly id: string;
  readonly batchId: string | null;
  readonly sppgId: string;
  readonly sppgNama: string;
  readonly jenis: AnomalyKind;
  readonly tingkat: AnomalySeverity;
  readonly detail: Record<string, unknown>;
  readonly dibukaAt: string;
  readonly ditutupAt: string | null;
  readonly ditutupOleh: string | null;
  readonly terbuka: boolean;
  readonly isDemo: boolean;
}

export interface AnomalyRow {
  readonly id: string;
  readonly batch_id: string | null;
  readonly sppg_id: string;
  readonly sppg_nama: string;
  readonly jenis: AnomalyKind;
  readonly tingkat: AnomalySeverity;
  readonly detail: Record<string, unknown>;
  readonly dibuka_at: Date;
  readonly ditutup_at: Date | null;
  readonly ditutup_oleh: string | null;
  readonly is_demo: boolean;
}

export const toAnomalyDto = (row: AnomalyRow): AnomalyDto =>
  Object.freeze({
    id: row.id,
    batchId: row.batch_id,
    sppgId: row.sppg_id,
    sppgNama: row.sppg_nama,
    jenis: row.jenis,
    tingkat: row.tingkat,
    detail: row.detail,
    dibukaAt: row.dibuka_at.toISOString(),
    ditutupAt: row.ditutup_at?.toISOString() ?? null,
    ditutupOleh: row.ditutup_oleh,
    terbuka: row.ditutup_at === null,
    isDemo: row.is_demo,
  });
