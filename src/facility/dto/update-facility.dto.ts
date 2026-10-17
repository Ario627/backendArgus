import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { FACILITY_KINDS, FACILITY_LEVELS, type FacilityKind, type FacilityLevel } from '../../common/constant/domain.constant.js';
import { trim, trimToNull } from '../../common/dto/transforms.js';

const CAPACITY_MAX_KG = 99999999.99;
const OPERATING_HOURS_PATTERN = /^\d{2}:\d{2}-\d{2}:\d{2}$/;

const isDefined = (_object: object, value: unknown): boolean => value !== undefined;

export class UpdateFacilityDto {
  @Transform(trim)
  @ValidateIf(isDefined)
  @IsString()
  @Length(2, 120)
  readonly nama?: string;

  @ValidateIf(isDefined)
  @IsIn(FACILITY_LEVELS)
  readonly tingkat?: FacilityLevel;

  @ValidateIf(isDefined)
  @IsIn(FACILITY_KINDS)
  readonly jenis?: FacilityKind;

  @ValidateIf(isDefined)
  @IsNumber()
  @Min(-90)
  @Max(90)
  readonly lat?: number;

  @ValidateIf(isDefined)
  @IsNumber()
  @Min(-180)
  @Max(180)
  readonly lng?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(CAPACITY_MAX_KG)
  readonly kapasitasKgHari?: number | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(11)
  @Matches(OPERATING_HOURS_PATTERN)
  readonly jamOperasi?: string | null;

  @ValidateIf(isDefined)
  @IsBoolean()
  readonly mitra?: boolean;

  @ValidateIf(isDefined)
  @IsBoolean()
  readonly aktif?: boolean;
}