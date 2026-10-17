import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  TICKET_KINDS,
  type TicketKind,
} from '../../common/constant/domain.constant.js';
import { trim } from '../../common/dto/transforms.js';

export const SPPG_SLUG_PATTERN = /^[a-z2-7]{12}$/;
export const FOTO_HASH_PATTERN = /^[0-9a-f]{64}$/;
export const TEXT_SAFE_PATTERN = /^[\P{Cc}\n\t]+$/u;

export class CreateTicketDto {
  @Transform(trim)
  @Matches(SPPG_SLUG_PATTERN)
  readonly sppgPublicId!: string;

  @IsIn(TICKET_KINDS)
  readonly jenis!: TicketKind;

  @Transform(trim)
  @IsString()
  @Length(20, 800)
  @Matches(TEXT_SAFE_PATTERN)
  readonly deskripsi!: string;

  @IsOptional()
  @Matches(FOTO_HASH_PATTERN)
  readonly fotoHash?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  readonly lat?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  readonly lng?: number | null;

  @IsUUID('7')
  readonly clientEventId!: string;
}