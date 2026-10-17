import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { trimToNull } from '../../common/dto/transforms.js';
import { TEXT_SAFE_PATTERN } from './create-ticket.dto.js';

export const VERIFY_TARGET_STATUSES = Object.freeze([
  'DIVERIFIKASI',
  'DITOLAK_MODERASI',
] as const);
export type VerifyTargetStatus = (typeof VERIFY_TARGET_STATUSES)[number];

export class VerifyTicketDto {
  @IsIn(VERIFY_TARGET_STATUSES)
  readonly status!: VerifyTargetStatus;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(400)
  @Matches(TEXT_SAFE_PATTERN)
  readonly catatan?: string | null;
}