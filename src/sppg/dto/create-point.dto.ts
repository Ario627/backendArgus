import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  DISTRIBUTION_POINT_KINDS,
  type DistributionPointKind,
} from '../../common/constant/domain.constant.js';
import { trim } from '../../common/dto/transforms.js';

export class CreatePointDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  readonly nama!: string;

  @IsIn(DISTRIBUTION_POINT_KINDS)
  readonly jenis!: DistributionPointKind;

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
}
