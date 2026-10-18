import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  PARAMETER_SOURCES,
  type ParameterSource,
} from '../../common/constant/domain.constant.js';
import { trim } from '../../common/dto/transforms.js';

const TEXT_SAFE_PATTERN = /^[\P{Cc}\n\t]+$/u;
const MAX_VALUE = 1000000000;

export class UpdateParameterDto {
  @ValidateIf((dto: UpdateParameterDto) => dto.nilai !== undefined)
  @IsNumber({ maxDecimalPlaces: 6, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_VALUE)
  readonly nilai?: number | null;

  @IsIn(PARAMETER_SOURCES)
  readonly sumber!: ParameterSource;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 24)
  @Matches(TEXT_SAFE_PATTERN)
  readonly satuan?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 400)
  @Matches(TEXT_SAFE_PATTERN)
  readonly catatan?: string | null;
}