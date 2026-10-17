import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';
import { trim } from '../../common/dto/transforms.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateServingDto {
  @Transform(trim)
  @Matches(DATE_PATTERN)
  @IsISO8601({ strict: true, strictSeparator: true })
  readonly tanggal!: string;

  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;

  @IsUUID()
  readonly menuItemId!: string;

  @IsOptional()
  @IsUUID()
  readonly titikId?: string;
}