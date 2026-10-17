import { HttpException, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BatchService } from '../batch/batch.service.js';
import { CreateBatchDto } from '../batch/dto/create-batch.dto.js';
import { validationExceptionFactory } from '../common/pipes/validation-exception.factory.js';
import type { AuthenticatedUser } from '../common/types.js';
import { AppendEventDto } from '../ledger/dto/append-event.dto.js';
import { LedgerEntryService } from '../ledger/ledger-entry.service.js';
import {
  SUPPORTED_SYNC_ITEM_TYPES,
  type SyncBatchDto,
  type SyncItemDto,
  type SyncItemType,
} from './dto/sync.dto.js';

export type SyncItemStatus = 'DIBUAT' | 'DUPLIKAT' | 'DITOLAK';

export interface SyncErrorItem {
  readonly code: string;
  readonly field?: string;
}

export interface SyncResultItem {
  readonly clientEventId: string | null;
  readonly tipe: SyncItemType;
  readonly status: SyncItemStatus;
  readonly resourceId?: string;
  readonly errors?: readonly SyncErrorItem[];
}

export interface SyncOutcome {
  readonly results: readonly SyncResultItem[];
  readonly partiallyFailed: boolean;
}

const validatePayload = async <T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
): Promise<T> => {
  const instance = plainToInstance(cls, payload);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length > 0) throw validationExceptionFactory(errors);
  return instance;
};

const readClientEventId = (payload: Record<string, unknown>): string | null =>
  typeof payload['clientEventId'] === 'string' ? payload['clientEventId'] : null;

const toSyncErrors = (error: HttpException): readonly SyncErrorItem[] => {
  const response = error.getResponse();
  if (response !== null && typeof response === 'object') {
    const record = response as Record<string, unknown>;
    const details = record['details'];
    if (Array.isArray(details)) {
      const mapped: SyncErrorItem[] = [];
      for (const entry of details) {
        if (entry === null || typeof entry !== 'object') continue;
        const item = entry as Record<string, unknown>;
        if (typeof item['code'] !== 'string') continue;
        mapped.push(
          typeof item['field'] === 'string'
            ? { code: item['code'], field: item['field'] }
            : { code: item['code'] },
        );
      }
      if (mapped.length > 0) return Object.freeze(mapped);
    }
    const code = record['code'];
    if (typeof code === 'string') return Object.freeze([{ code }]);
  }
  return Object.freeze([
    { code: error.getStatus() >= 500 ? 'SYS_INTERNAL' : 'SYNC_ITEM_DITOLAK' },
  ]);
};

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly batchService: BatchService,
    private readonly entryService: LedgerEntryService,
  ) {}

  async process(dto: SyncBatchDto, actor: AuthenticatedUser): Promise<SyncOutcome> {
    const results: SyncResultItem[] = [];
    for (const item of dto.items) {
      results.push(await this.processItem(item, actor));
    }
    return {
      results: Object.freeze(results),
      partiallyFailed: results.some((result) => result.status === 'DITOLAK'),
    };
  }

  private async processItem(item: SyncItemDto, actor: AuthenticatedUser): Promise<SyncResultItem> {
    const clientEventId = readClientEventId(item.payload);
    if (!SUPPORTED_SYNC_ITEM_TYPES.includes(item.tipe)) {
      return {
        clientEventId,
        tipe: item.tipe,
        status: 'DITOLAK',
        errors: [{ code: 'SYNC_TYPE_UNSUPPORTED', field: item.tipe }],
      };
    }

    try {
      if (item.tipe === 'batch') {
        const payload = await validatePayload(CreateBatchDto, item.payload);
        const result = await this.batchService.create(payload, actor);
        return {
          clientEventId: payload.clientEventId,
          tipe: item.tipe,
          status: result.duplicate ? 'DUPLIKAT' : 'DIBUAT',
          resourceId: result.batch.id,
        };
      }

      if (item.batchId === undefined) {
        return {
          clientEventId,
          tipe: item.tipe,
          status: 'DITOLAK',
          errors: [{ code: 'SYNC_BATCH_ID_REQUIRED', field: 'batchId' }],
        };
      }
      const payload = await validatePayload(AppendEventDto, item.payload);
      const result = await this.entryService.appendEvent(item.batchId, payload, actor);
      return {
        clientEventId: payload.clientEventId,
        tipe: item.tipe,
        status: result.duplicate ? 'DUPLIKAT' : 'DIBUAT',
        resourceId: String(result.event.id),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        return {
          clientEventId,
          tipe: item.tipe,
          status: 'DITOLAK',
          errors: toSyncErrors(error),
        };
      }
      this.logger.error(
        `item sinkronisasi gagal tidak terduga tipe=${item.tipe}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        clientEventId,
        tipe: item.tipe,
        status: 'DITOLAK',
        errors: [{ code: 'SYS_INTERNAL' }],
      };
    }
  }
}