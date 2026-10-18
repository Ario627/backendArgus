import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { generateId } from '../common/utils/id.util.js';
import type { NarrativeCacheRow } from './llm.types.js';

const FIND_FRESH_SQL = `
SELECT id, cache_key, narasi, model, created_at, expires_at
  FROM narasi_dashboard
 WHERE cache_key = $1
   AND expires_at > now()
 LIMIT 1`;

const UPSERT_SQL = `
INSERT INTO narasi_dashboard (
  id, cache_key, sppg_id, tanggal, model, narasi,
  prompt_tokens, completion_tokens, created_at, expires_at
)
VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, now(), now() + make_interval(mins => $9::int))
ON CONFLICT (cache_key) DO UPDATE
   SET narasi = EXCLUDED.narasi,
       model = EXCLUDED.model,
       prompt_tokens = EXCLUDED.prompt_tokens,
       completion_tokens = EXCLUDED.completion_tokens,
       created_at = now(),
       expires_at = EXCLUDED.expires_at`;

export interface NarrativeCacheWrite {
  readonly cacheKey: string;
  readonly sppgId: string | null;
  readonly tanggal: string;
  readonly model: string;
  readonly narasi: string;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly ttlMinutes: number;
}

@Injectable()
export class NarrativeCacheService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findFresh(cacheKey: string): Promise<NarrativeCacheRow | null> {
    const rows = await this.dataSource.query<NarrativeCacheRow[]>(
      FIND_FRESH_SQL,
      [cacheKey],
    );
    return rows[0] ?? null;
  }

  async save(write: NarrativeCacheWrite): Promise<void> {
    await this.dataSource.query(UPSERT_SQL, [
      generateId(),
      write.cacheKey,
      write.sppgId,
      write.tanggal,
      write.model,
      write.narasi,
      write.promptTokens,
      write.completionTokens,
      write.ttlMinutes,
    ]);
  }
}