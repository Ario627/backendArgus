import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  DISTRIBUTION_POINT_KINDS,
  type DistributionPointKind,
} from '../../common/constant/domain.constant.js';
import { trim } from '../../common/dto/transforms.js';

const isDefined = (_object: object, value: unknown): boolean =>
  value !== undefined;

export class UpdatePointDto {
  @Transform(trim)
  @ValidateIf(isDefined)
  @IsString()
  @Length(2, 120)
  readonly nama?: string;

  @ValidateIf(isDefined)
  @IsIn(DISTRIBUTION_POINT_KINDS)
  readonly jenis?: DistributionPointKind;

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

  @ValidateIf(isDefined)
  @IsBoolean()
  readonly aktif?: boolean;
}
