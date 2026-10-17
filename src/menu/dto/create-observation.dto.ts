import { Transform } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { trim } from '../../common/dto/transforms.js';
import {
  LEFTOVER_LEVEL_MAX,
  LEFTOVER_LEVEL_MIN,
} from '../leftover-scale.util.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const POSTGRES_INT_MAX = 2147483647;

export class CreateObservationDto {
  @IsUUID('7')
  readonly clientEventId!: string;

  @Transform(trim)
  @Matches(DATE_PATTERN)
  @IsISO8601({ strict: true, strictSeparator: true })
  readonly tanggal!: string;

  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;

  @IsUUID()
  readonly titikId!: string;

  @IsUUID()
  readonly menuItemId!: string;

  @IsInt()
  @Min(LEFTOVER_LEVEL_MIN)
  @Max(LEFTOVER_LEVEL_MAX)
  readonly tingkatSisa!: number;

  @IsInt()
  @Min(1)
  @Max(POSTGRES_INT_MAX)
  readonly jumlahPorsiDinilai!: number;
}