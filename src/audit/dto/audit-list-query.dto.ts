import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import { trim } from '../../common/dto/transforms.js';

const TEXT_SAFE_PATTERN = /^[\P{Cc}\n\t]+$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class AuditListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsUUID()
  readonly aktor?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(3, 120)
  @Matches(TEXT_SAFE_PATTERN)
  readonly aksi?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  @Matches(TEXT_SAFE_PATTERN)
  readonly entitas?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(DATE_PATTERN)
  @IsISO8601({ strict: true, strictSeparator: true })
  readonly from?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(DATE_PATTERN)
  @IsISO8601({ strict: true, strictSeparator: true })
  readonly to?: string;
}