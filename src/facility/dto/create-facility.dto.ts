import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { FACILITY_KINDS, FACILITY_LEVELS, type FacilityKind, type FacilityLevel } from '../../common/constant/domain.constant.js';
import { trim, trimToNull } from '../../common/dto/transforms.js';

const CAPACITY_MAX_KG = 99999999.99;
const OPERATING_HOURS_PATTERN = /^\d{2}:\d{2}-\d{2}:\d{2}$/;

export class CreateFacilityDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  readonly nama!: string;

  @IsIn(FACILITY_LEVELS)
  readonly tingkat!: FacilityLevel;

  @IsIn(FACILITY_KINDS)
  readonly jenis!: FacilityKind;

  @IsNumber()
  @Min(-90)
  @Max(90)
  readonly lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  readonly lng!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(CAPACITY_MAX_KG)
  readonly kapasitasKgHari?: number | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(11)
  @Matches(OPERATING_HOURS_PATTERN)
  readonly jamOperasi?: string | null;

  @IsOptional()
  @IsBoolean()
  readonly mitra?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly aktif?: boolean;
}