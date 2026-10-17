import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  BATCH_STATUSES,
  DISPOSITION_TIERS,
  WASTE_FLOWS,
  type BatchStatus,
  type DispositionTier,
  type WasteFlow,
} from '../../common/constant/domain.constant.js';

const MAX_PAGE_SIZE = 100;

export class BatchListQueryDto {
  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;

  @IsOptional()
  @IsIn(BATCH_STATUSES)
  readonly status?: BatchStatus;

  @IsOptional()
  @IsIn(DISPOSITION_TIERS)
  readonly tier?: DispositionTier;

  @IsOptional()
  @IsIn(WASTE_FLOWS)
  readonly aliran?: WasteFlow;

  @IsOptional()
  @IsUUID('7')
  readonly cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  readonly limit?: number;
}