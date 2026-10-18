import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UserRole } from '../common/constant/domain.constant.js';
import { DEFAULT_PAGE_SIZE } from '../common/dto/list-query.dto.js';
import type { PaginatedItems } from '../common/types.js';
import { wibDayRangeUtc } from '../common/utils/daily-range.util.js';
import { AuditLog } from '../database/entities/audit-log.entity.js';
import {
  toAuditLogDto,
  type AuditLogDto,
  type AuditLogRow,
} from './audit.mapper.js';
import type { AuditListQueryDto } from './dto/audit-list-query.dto.js';

export const EXPORT_AUDIT_ACTION = 'export.batches';

const EXPORT_QUOTA_WINDOW_HOURS = 24;

const CONSUME_QUOTA_SQL = `
WITH lock AS (
  SELECT pg_advisory_xact_lock(hashtext($2), hashtext($1::text)) AS taken
), recent AS (
  SELECT count(*)::int AS terpakai
    FROM audit_log a, lock
   WHERE a.aktor = $1::uuid
     AND a.aksi = $2
     AND a.ts > now() - make_interval(hours => $7::int)
), inserted AS (
  INSERT INTO audit_log (aktor, aktor_peran, aksi, entitas, entitas_id, detail, request_id)
  SELECT $1::uuid, $3, $2, $8, NULL, $4::jsonb, $5
    FROM recent
   WHERE recent.terpakai < $6
  RETURNING id
)
SELECT (SELECT terpakai FROM recent) AS terpakai,
       EXISTS (SELECT 1 FROM inserted) AS tercatat`;

const INSERT_SQL = `
INSERT INTO audit_log (aktor, aktor_peran, aksi, entitas, entitas_id, detail, request_id)
VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`;

const LIST_SQL = `
SELECT id, aktor, aktor_peran, aksi, entitas, entitas_id, detail, request_id, ts
  FROM audit_log
 WHERE ($1::uuid IS NULL OR aktor = $1)
   AND ($2::text IS NULL OR aksi = $2)
   AND ($3::text IS NULL OR entitas = $3)
   AND ($4::timestamptz IS NULL OR ts >= $4)
   AND ($5::timestamptz IS NULL OR ts < $5)
 ORDER BY ts DESC, id DESC
 LIMIT $6 OFFSET $7`;

const COUNT_SQL = `
SELECT count(*)::int AS total
  FROM audit_log
 WHERE ($1::uuid IS NULL OR aktor = $1)
   AND ($2::text IS NULL OR aksi = $2)
   AND ($3::text IS NULL OR entitas = $3)
   AND ($4::timestamptz IS NULL OR ts >= $4)
   AND ($5::timestamptz IS NULL OR ts < $5)`;

export interface AuditEntryInput {
  readonly aktor: string | null;
  readonly aktorPeran: UserRole | null;
  readonly aksi: string;
  readonly entitas: string | null;
  readonly entitasId: string | null;
  readonly detail: Record<string, unknown>;
  readonly requestId: string | null;
}

export interface ExportQuotaInput {
  readonly aktor: string;
  readonly aktorPeran: UserRole;
  readonly limitPerDay: number;
  readonly detail: Record<string, unknown>;
  readonly requestId: string | null;
}

export interface QuotaInput {
  readonly aktor: string;
  readonly aktorPeran: UserRole;
  readonly aksi: string;
  readonly limitPerDay: number;
  readonly windowHours: number;
  readonly entitas: string;
  readonly detail: Record<string, unknown>;
  readonly requestId: string | null;
}

export interface ExportQuotaResult {
  readonly allowed: boolean;
  readonly used: number;
}

interface QuotaRow {
  readonly terpakai: number;
  readonly tercatat: boolean;
}

interface CountRow {
  readonly total: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
  ) {}

  async record(input: AuditEntryInput): Promise<void> {
    try {
      await this.repository.manager.query(INSERT_SQL, [
        input.aktor,
        input.aktorPeran,
        input.aksi,
        input.entitas,
        input.entitasId,
        JSON.stringify(input.detail),
        input.requestId,
      ]);
    } catch (error) {
      this.logger.error(
        `gagal menulis audit_log aksi=${input.aksi}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async consumeExportQuota(
    input: ExportQuotaInput,
  ): Promise<ExportQuotaResult> {
    return this.consumeQuota({
      aktor: input.aktor,
      aktorPeran: input.aktorPeran,
      aksi: EXPORT_AUDIT_ACTION,
      limitPerDay: input.limitPerDay,
      windowHours: EXPORT_QUOTA_WINDOW_HOURS,
      entitas: 'export',
      detail: input.detail,
      requestId: input.requestId,
    });
  }

  async consumeQuota(input: QuotaInput): Promise<ExportQuotaResult> {
    const rows = await this.repository.manager.query<QuotaRow[]>(
      CONSUME_QUOTA_SQL,
      [
        input.aktor,
        input.aksi,
        input.aktorPeran,
        JSON.stringify(input.detail),
        input.requestId,
        input.limitPerDay,
        input.windowHours,
        input.entitas,
      ],
    );
    const row = rows[0];
    return Object.freeze({
      allowed: row?.tercatat === true,
      used: row?.terpakai ?? 0,
    });
  }

  async list(query: AuditListQueryDto): Promise<PaginatedItems<AuditLogDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const params = [
      query.aktor ?? null,
      query.aksi ?? null,
      query.entitas ?? null,
      query.from === undefined ? null : wibDayRangeUtc(query.from).start,
      query.to === undefined ? null : wibDayRangeUtc(query.to).end,
    ];
    const rows = await this.repository.manager.query<AuditLogRow[]>(LIST_SQL, [
      ...params,
      limit,
      (page - 1) * limit,
    ]);
    const [countRow] = await this.repository.manager.query<CountRow[]>(
      COUNT_SQL,
      params,
    );
    return {
      items: rows.map(toAuditLogDto),
      nextCursor: null,
      total: countRow?.total ?? 0,
    };
  }
}
