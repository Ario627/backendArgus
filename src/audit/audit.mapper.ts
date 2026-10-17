import type { UserRole } from '../common/constant/domain.constant.js';

export interface AuditLogDto {
  readonly id: number;
  readonly aktor: string | null;
  readonly aktorPeran: UserRole | null;
  readonly aksi: string;
  readonly entitas: string | null;
  readonly entitasId: string | null;
  readonly detail: Record<string, unknown>;
  readonly requestId: string | null;
  readonly ts: string;
}

export interface AuditLogRow {
  readonly id: string | number;
  readonly aktor: string | null;
  readonly aktor_peran: UserRole | null;
  readonly aksi: string;
  readonly entitas: string | null;
  readonly entitas_id: string | null;
  readonly detail: Record<string, unknown>;
  readonly request_id: string | null;
  readonly ts: Date;
}

export const toAuditLogDto = (row: AuditLogRow): AuditLogDto =>
  Object.freeze({
    id: Number(row.id),
    aktor: row.aktor,
    aktorPeran: row.aktor_peran,
    aksi: row.aksi,
    entitas: row.entitas,
    entitasId: row.entitas_id,
    detail: row.detail,
    requestId: row.request_id,
    ts: row.ts.toISOString(),
  });