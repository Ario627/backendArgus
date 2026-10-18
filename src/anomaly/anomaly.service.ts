import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { PaginatedItems } from '../common/types.js';
import { DEFAULT_PAGE_SIZE } from '../common/dto/list-query.dto.js';
import type { AppConfiguration } from '../config/configuration.js';
import { anomalyClosedError, anomalyNotFoundError } from './anomaly.errors.js';
import type { AnomalyListQueryDto } from './dto/anomaly-list-query.dto.js';
import type { CloseAnomalyDto } from './dto/close-anomaly.dto.js';
import {
  toAnomalyDto,
  type AnomalyDto,
  type AnomalyRow,
} from './anomaly.mapper.js';

const LIST_SQL = `
SELECT a.id,
       a.batch_id,
       COALESCE(a.sppg_id, b.sppg_id) AS sppg_id,
       s.nama AS sppg_nama,
       a.jenis,
       a.tingkat,
       a.detail,
       a.dibuka_at,
       a.ditutup_at,
       a.ditutup_oleh,
       a.is_demo
  FROM anomali a
  LEFT JOIN batch b ON b.id = a.batch_id
  JOIN sppg s ON s.id = COALESCE(a.sppg_id, b.sppg_id)
 WHERE ($1::bool IS NULL OR (a.ditutup_at IS NULL) = $1)
   AND ($2::text IS NULL OR a.jenis = $2)
   AND ($3::text IS NULL OR a.tingkat = $3)
   AND ($4::uuid IS NULL OR COALESCE(a.sppg_id, b.sppg_id) = $4)
   AND ($7::bool IS TRUE OR a.is_demo = FALSE)
 ORDER BY a.dibuka_at DESC, a.id ASC
 LIMIT $5 OFFSET $6`;

const COUNT_SQL = `
SELECT count(*)::int AS total
  FROM anomali a
  LEFT JOIN batch b ON b.id = a.batch_id
 WHERE ($1::bool IS NULL OR (a.ditutup_at IS NULL) = $1)
   AND ($2::text IS NULL OR a.jenis = $2)
   AND ($3::text IS NULL OR a.tingkat = $3)
   AND ($4::uuid IS NULL OR COALESCE(a.sppg_id, b.sppg_id) = $4)
   AND ($5::bool IS TRUE OR a.is_demo = FALSE)`;

const CLOSE_SQL = `
WITH closed AS (
  UPDATE anomali
     SET ditutup_at = now(),
         ditutup_oleh = $2,
         detail = $3::jsonb
   WHERE id = $1
     AND ditutup_at IS NULL
  RETURNING id
)
SELECT id FROM closed`;

interface IdRow {
  readonly id: string;
}

interface CountRow {
  readonly total: number;
}

export interface CloseAnomalyResult {
  readonly anomaly: AnomalyDto;
}

@Injectable()
export class AnomalyService {
  private readonly demoMode: boolean;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.demoMode = config.demoMode;
  }

  private async loadRow(id: string): Promise<AnomalyRow | null> {
    const rows = await this.dataSource.query<AnomalyRow[]>(
      `SELECT a.id,
              a.batch_id,
              COALESCE(a.sppg_id, b.sppg_id) AS sppg_id,
              s.nama AS sppg_nama,
              a.jenis, a.tingkat, a.detail,
              a.dibuka_at, a.ditutup_at, a.ditutup_oleh, a.is_demo
         FROM anomali a
         LEFT JOIN batch b ON b.id = a.batch_id
         JOIN sppg s ON s.id = COALESCE(a.sppg_id, b.sppg_id)
        WHERE a.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(query: AnomalyListQueryDto): Promise<PaginatedItems<AnomalyDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const terbuka = query.terbuka ?? true;
    const rows = await this.dataSource.query<AnomalyRow[]>(LIST_SQL, [
      terbuka,
      query.jenis ?? null,
      query.tingkat ?? null,
      query.sppgId ?? null,
      limit,
      (page - 1) * limit,
      this.demoMode,
    ]);
    const [countRow] = await this.dataSource.query<CountRow[]>(COUNT_SQL, [
      terbuka,
      query.jenis ?? null,
      query.tingkat ?? null,
      query.sppgId ?? null,
      this.demoMode,
    ]);
    return {
      items: rows.map(toAnomalyDto),
      nextCursor: null,
      total: countRow?.total ?? 0,
    };
  }

  async close(
    id: string,
    dto: CloseAnomalyDto,
    actorId: string,
  ): Promise<CloseAnomalyResult> {
    const before = await this.loadRow(id);
    if (before === null) throw anomalyNotFoundError();
    if (before.ditutup_at !== null) throw anomalyClosedError();
    const merged = {
      ...before.detail,
      penutupan: {
        catatan: dto.catatan,
        oleh: actorId,
        at: new Date().toISOString(),
      },
    };
    const closed = await this.dataSource.query<IdRow[]>(CLOSE_SQL, [
      id,
      actorId,
      JSON.stringify(merged),
    ]);
    if (closed.length === 0) throw anomalyClosedError();
    const after = await this.loadRow(id);
    if (after === null) throw anomalyNotFoundError();
    return { anomaly: toAnomalyDto(after) };
  }
}
