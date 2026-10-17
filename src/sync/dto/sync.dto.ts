import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export const SYNC_ITEM_TYPES = Object.freeze([
  'batch',
  'ledger_event',
  'observasi_sisa',
  'tiket_warga',
] as const);
export type SyncItemType = (typeof SYNC_ITEM_TYPES)[number];

export const SUPPORTED_SYNC_ITEM_TYPES: readonly SyncItemType[] = Object.freeze(
  ['batch', 'ledger_event', 'observasi_sisa'],
);

export const SYNC_MAX_ITEMS = 50;

export class SyncItemDto {
  @IsIn(SYNC_ITEM_TYPES)
  readonly tipe!: SyncItemType;

  @IsOptional()
  @IsUUID()
  readonly batchId?: string;

  @IsObject()
  readonly payload!: Record<string, unknown>;
}

export class SyncBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SYNC_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => SyncItemDto)
  readonly items!: SyncItemDto[];
}
