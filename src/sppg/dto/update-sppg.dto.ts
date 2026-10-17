import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { trim, trimToNull } from '../../common/dto/transforms.js';

const POSTGRES_INT_MAX = 2147483647;
const CAPACITY_MAX_KG = 99999999.99;

const isDefined = (_object: object, value: unknown): boolean =>
  value !== undefined;

export class UpdateSppgDto {
  @Transform(trim)
  @ValidateIf(isDefined)
  @IsString()
  @Length(2, 120)
  readonly nama?: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  readonly alamat?: string | null;

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

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(POSTGRES_INT_MAX)
  readonly porsiPerHari?: number;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly mitra?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(CAPACITY_MAX_KG)
  readonly kapasitasOlahKg?: number | null;

  @ValidateIf(isDefined)
  @IsBoolean()
  readonly aktif?: boolean;
}
